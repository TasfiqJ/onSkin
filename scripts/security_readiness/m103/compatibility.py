"""Run only in the isolated candidate, through sandbox.py. Synthetic inputs."""
import asyncio, hashlib, importlib.metadata, json, os, pathlib, socket, ssl, subprocess, sys, tempfile
import anyio, certifi
from mcp import ClientSession, types
from mcp.server import Server
from mcp.shared.message import SessionMessage


async def lifecycle():
    server=Server('onskin-local-synthetic')
    @server.list_tools()
    async def tools_list():return []
    c_send,s_read=anyio.create_memory_object_stream[SessionMessage](8)
    s_send,c_read=anyio.create_memory_object_stream[SessionMessage](8)
    async with anyio.create_task_group() as group:
        group.start_soon(server.run,s_read,s_send,server.create_initialization_options())
        async with ClientSession(c_read,c_send) as session:
            result=await session.initialize()
            assert result.serverInfo.name=='onskin-local-synthetic'
            assert (await session.list_tools()).tools==[]
        group.cancel_scope.cancel()


def tls():
    from cryptography import x509
    from cryptography.x509.oid import NameOID
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import rsa
    import datetime
    key=rsa.generate_private_key(public_exponent=65537,key_size=2048)
    name=x509.Name([x509.NameAttribute(NameOID.COMMON_NAME,'local-synthetic.invalid')])
    now=datetime.datetime.now(datetime.timezone.utc)
    cert=x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key.public_key()).serial_number(1).not_valid_before(now-datetime.timedelta(minutes=1)).not_valid_after(now+datetime.timedelta(minutes=5)).add_extension(x509.SubjectAlternativeName([x509.DNSName('local-synthetic.invalid')]),False).sign(key,hashes.SHA256())
    with tempfile.TemporaryDirectory() as temp:
        p=pathlib.Path(temp);(p/'cert.pem').write_bytes(cert.public_bytes(serialization.Encoding.PEM))
        (p/'key.pem').write_bytes(key.private_bytes(serialization.Encoding.PEM,serialization.PrivateFormat.PKCS8,serialization.NoEncryption()))
        server_context=ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER);server_context.load_cert_chain(p/'cert.pem',p/'key.pem')
        context=ssl.create_default_context(cafile=certifi.where())
        assert context.check_hostname and context.verify_mode==ssl.CERT_REQUIRED
        client_in,client_out,server_in,server_out=[ssl.MemoryBIO() for _ in range(4)]
        client=context.wrap_bio(client_in,client_out,server_side=False,server_hostname='local-synthetic.invalid')
        server=server_context.wrap_bio(server_in,server_out,server_side=True)
        rejected=False
        for _ in range(10):
            for endpoint in [client,server]:
                try:endpoint.do_handshake()
                except ssl.SSLWantReadError:pass
                except ssl.SSLCertVerificationError:rejected=True;break
            if rejected:break
            server_in.write(client_out.read());client_in.write(server_out.read())
        assert rejected,'untrusted certificate accepted'
        return dict(bundle_sha256=hashlib.sha256(pathlib.Path(certifi.where()).read_bytes()).hexdigest(),
                    trusted_ca_count=len(context.get_ca_certs()),untrusted_in_memory_certificate='REJECTED')


def main():
    assert importlib.metadata.version('mcp')=='1.30.0'
    assert importlib.metadata.version('certifi')=='2026.10.19'
    assert importlib.metadata.version('semgrep')=='1.181.0'
    assert 'SYNTHETIC_SECRET' not in os.environ and 'HTTPS_PROXY' not in os.environ
    for family in [socket.AF_INET,socket.AF_INET6]:
        try:socket.socket(family,socket.SOCK_STREAM)
        except PermissionError:pass
        else:raise AssertionError('network socket permitted')
    with socket.socket(socket.AF_UNIX,socket.SOCK_STREAM) as local:
        try:local.bind('/tmp/onskin-never-created.sock')
        except PermissionError:pass
        else:raise AssertionError('listener permitted')
    anyio.run(lifecycle)
    print(json.dumps(dict(admission='NONE',mcp_lifecycle='PASS_INITIALIZE_LIST_CANCEL',
        ipv4_ipv6_listen='DENIED_BY_SECCOMP',credentials='REMOVED',tls=tls())))


if __name__=='__main__':main()
