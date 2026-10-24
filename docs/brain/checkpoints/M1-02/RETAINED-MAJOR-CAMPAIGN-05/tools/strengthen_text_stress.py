from pathlib import Path
root = Path(__file__).resolve().parent
for name in ['e2e-wrapper.mjs','e2e-fragment.txt']:
    backup = root/('inline-v1-'+name)
    if backup.exists():
        assert backup.read_bytes() == (root/name).read_bytes()
    else:
        backup.write_bytes((root/name).read_bytes())
fragment = (root/'e2e-fragment.txt').read_text(encoding='utf-8')
helper = '''    const r05VisibleAction = async label => {
      await r05KeyEnter(label);
      await delay(600);
      const geometry = await evaluate(client, `(() => {
        const el = document.querySelector('[aria-label=${JSON.stringify(label)}]');
        el.scrollIntoView({block:'center',inline:'nearest'});
        return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => {
          const r=el.getBoundingClientRect(), x=r.x+r.width/2, y=r.y+r.height/2;
          const hit=document.elementFromPoint(x,y);
          resolve({x,y,width:r.width,height:r.height,viewport:{width:innerWidth,height:innerHeight},hit:hit===el||el.contains(hit),focused:document.activeElement===el});
        })));
      })()`, true);
      assert(geometry.x>0 && geometry.x<geometry.viewport.width && geometry.y>0 && geometry.y<geometry.viewport.height && geometry.hit && geometry.focused, 'Text stress action is not visibly reachable: '+label);
      writeJson('R05-text200-action-'+label.replaceAll(' ','-')+'.json',geometry);
    };
'''
needle = "    await retainedRoute(client, '/you');"
assert fragment.count(needle) >= 1
fragment = fragment.replace(needle,helper+needle,1)
fragment = fragment.replace("      await scrollTextIntoView(client,'Check Photo cleanup again');\n      await r05Capture('R05-12-360-text200-cleanup');", "      await r05VisibleAction('Check Photo cleanup again');\n      await r05Capture('R05-12-360-text200-cleanup');")
fragment = fragment.replace("      await scrollTextIntoView(client,'Check Shelf again');\n      await r05Capture('R05-13-360-text200-shelf');", "      await r05VisibleAction('Check Shelf again');\n      await r05Capture('R05-13-360-text200-shelf');")
assert fragment.count('await r05VisibleAction(') == 2
(root/'e2e-fragment.txt').write_text(fragment,encoding='utf-8')
print('Strengthened checkpoint-only 200% text assertions; production and original driver unchanged.')
