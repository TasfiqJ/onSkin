"""Run with the selected isolated site; all network requests stay on loopback."""
import asyncio, contextlib, http.server, json, os, pathlib, socket, sys, tempfile, threading
os.environ.update(SEMGREP_SEND_METRICS='off',SEMGREP_ENABLE_VERSION_CHECK='0',SEMGREP_MCP_DISABLE_TRACING='true',USE_SEMGREP_RPC='false')
for name in ('SEMGREP_APP_TOKEN','SEMGREP_TOKEN'):
    assert not os.environ.get(name),'CREDENTIALS_NOT_ALLOWED'
selected=pathlib.Path(sys.argv[1])
def network_guard(event,args):
    if event=='socket.connect' and args[0].family in (socket.AF_INET,socket.AF_INET6):
        assert args[1][0] in ('127.0.0.1','localhost','::1'),'NONLOCAL_NETWORK_FORBIDDEN'
sys.addaudithook(network_guard)
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from mcp.server.fastmcp import FastMCP
import semgrep.telemetry
import semgrep.mcp.server
from opentelemetry import trace, propagate
from opentelemetry._logs import get_logger_provider
from opentelemetry.proto.collector.trace.v1.trace_service_pb2 import ExportTraceServiceRequest
received=[]
class Receiver(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        raw=self.rfile.read(int(self.headers['Content-Length']))
        if self.path=='/v1/traces':
            request=ExportTraceServiceRequest();request.ParseFromString(raw)
            count=sum(len(scope.spans) for resource in request.resource_spans for scope in resource.scope_spans)
            received.append(dict(path=self.path,spans=count,content_type=self.headers.get('Content-Type')))
        self.send_response(200);self.send_header('Content-Type','application/x-protobuf');self.end_headers()
    def log_message(self,*args):pass
http=http.server.ThreadingHTTPServer(('127.0.0.1',0),Receiver);thread=threading.Thread(target=http.serve_forever,daemon=True);thread.start()
telemetry=semgrep.telemetry.Telemetry();telemetry.configure(True,'http://127.0.0.1:'+str(http.server_port),service_name='wave02-synthetic-local')
with trace.get_tracer('wave02-synthetic').start_as_current_span('wave02-local-export') as span:
    carrier={};propagate.inject(carrier);assert 'traceparent' in carrier
    parent=propagate.extract(carrier);assert trace.get_current_span(parent).get_span_context().trace_id==span.get_span_context().trace_id
    thread_context=[]
    worker=threading.Thread(target=lambda:thread_context.append(trace.get_current_span().get_span_context().trace_id));worker.start();worker.join()
    assert thread_context==[span.get_span_context().trace_id]
assert trace.get_tracer_provider().force_flush(timeout_millis=10000)
assert received and sum(r['spans'] for r in received)>=1
get_logger_provider().force_flush(timeout_millis=10000)
trace.get_tracer_provider().shutdown();get_logger_provider().shutdown();http.shutdown();http.server_close()
server_source="""import os
os.environ.update(SEMGREP_MCP_DISABLE_TRACING='true',SEMGREP_SEND_METRICS='off',SEMGREP_ENABLE_VERSION_CHECK='0',USE_SEMGREP_RPC='false')
from mcp.server.fastmcp import FastMCP
from semgrep.mcp.server import register,deregister_tools,server_lifespan
server=FastMCP('wave02-semgrep-local',lifespan=server_lifespan)
register(server);deregister_tools(server,'stdio')
server.run(transport='stdio')
"""
async def session_smoke():
    with tempfile.TemporaryDirectory(prefix='wave02-mcp-') as directory:
        source=pathlib.Path(directory)/'server.py';source.write_text(server_source)
        bootstrap='import sys,site,runpy;site.addsitedir(sys.argv.pop(1));runpy.run_path(sys.argv[1],run_name="__main__")'
        launcher=pathlib.Path('/work/bridge2/old-launchers') if selected.name=='old-site' else selected.parent.parent.parent/'bin'
        params=StdioServerParameters(command=sys.executable,args=['-I','-S','-B','-c',bootstrap,str(selected),str(source)],env={**os.environ,'PATH':str(launcher)+':'+os.environ['PATH']})
        async with stdio_client(params) as (read,write):
            async with ClientSession(read,write) as session:
                initialized=await session.initialize();tools=await session.list_tools();names=[t.name for t in tools.tools]
                assert names and 'get_supported_languages' in names
                await session.send_ping()
                result=await session.call_tool('get_supported_languages',{})
                assert not result.isError and result.content
                return dict(initialized=True,tool_count=len(names),ping=True,supported_languages_call=True,server_lifespan='ORIGINAL_SEMGREP',transport='stdio',shutdown=True)
async def http_lifecycle():
    app=FastMCP('wave02-http-lifecycle',stateless_http=False).streamable_http_app()
    async with app.router.lifespan_context(app):pass
    return True
result=dict(mcp=asyncio.run(session_smoke()),http_lifecycle=asyncio.run(http_lifecycle()),otel=dict(semgrep_Telemetry_configure=True,trace_propagation=True,thread_context=True,local_otlp_http_export=True,received=received),external_requests=False,synthetic_only=True)
print(json.dumps(result,sort_keys=True))
