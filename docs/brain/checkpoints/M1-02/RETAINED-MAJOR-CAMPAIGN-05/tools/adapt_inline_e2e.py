from pathlib import Path

root = Path(__file__).resolve().parent
for name in ['e2e-wrapper.mjs', 'e2e-fragment.txt']:
    original = root / name
    backup = root / ('routed-' + name)
    assert not backup.exists()
    backup.write_bytes(original.read_bytes())

fragment = (root/'e2e-fragment.txt').read_text(encoding='utf-8')
fragment = fragment.replace("await waitForPath(client, '/settings/local-recovery');", "await waitForPath(client, '/you');")
fragment = fragment.replace("await r05KeyEnter('Back');", "await r05KeyEnter('Close local recovery');\n    assert(!(await evaluate(client, 'document.body.innerText')).includes('No pending cleanup'), 'Close left local evidence mounted');")
open_section = """await retainedRoute(client, '/you');
    await scrollTextIntoView(client, 'Local recovery', {exact:false});
    if (!(await evaluate(client, `document.querySelector('[aria-label="Close local recovery"]') !== null`))) {
      await clickByText(client, 'Local recovery', {exact:false});
    }"""
fragment = fragment.replace("await retainedRoute(client,'/settings/local-recovery');", open_section)
fragment = fragment.replace("await client.send('Page.reload',{ignoreCache:true});\n    await waitForText(client,'No pending cleanup',60000);", "await client.send('Page.reload',{ignoreCache:true});\n    await waitForText(client, 'Local recovery', 60000);\n    await scrollTextIntoView(client, 'Local recovery', {exact:false});\n    await clickByText(client, 'Local recovery', {exact:false});\n    await waitForText(client,'No pending cleanup',60000);")
fragment = fragment.replace("await client.send('Page.reload',{ignoreCache:true});\n      await waitForText(client,'No pending cleanup',60000);", "await client.send('Page.reload',{ignoreCache:true});\n      await waitForText(client, 'Local recovery', 60000);\n      await scrollTextIntoView(client, 'Local recovery', {exact:false});\n      await clickByText(client, 'Local recovery', {exact:false});\n      await waitForText(client,'No pending cleanup',60000);")
fragment = fragment.replace("localReads:true,isolatedFailure:true", "existingYouSection:true,closeAndReopen:true,localReads:true,isolatedFailure:true")
assert '/settings/local-recovery' not in fragment
(root/'e2e-fragment.txt').write_text(fragment, encoding='utf-8')

wrapper = (root/'e2e-wrapper.mjs').read_text(encoding='utf-8')
wrapper = wrapper.replace("await navigateClientSide(client, '/settings/local-recovery');\n      await waitForText", "await navigateClientSide(client, '/you');\n      await scrollTextIntoView(client, 'Local recovery', {exact:false});\n      await clickByText(client, 'Local recovery', {exact:false});\n      await waitForText")
wrapper = wrapper.replace("await navigateClientSide(client, '/you');\n      const liveState", "await clickByText(client, 'Close local recovery');\n      await navigateClientSide(client, '/you');\n      const liveState")
wrapper = wrapper.replace("await navigateClientSide(client, '/settings/local-recovery');", "await navigateClientSide(client, '/you');")
assert '/settings/local-recovery' not in wrapper
(root/'e2e-wrapper.mjs').write_text(wrapper, encoding='utf-8')
print('Adapted only checkpoint-local driver to existing You expansion/Close/reopen.')
