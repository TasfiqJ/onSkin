export async function runContinuity17({client,evaluate,waitForText,waitForCondition,captureStep,writeJson,tap,retainAction,baseUrl,assert,delay,fillByLabel}) {
  async function enter(label) {
    await evaluate(client, `(()=>{const n=[...document.querySelectorAll('[role="button"],button')].find(n=>n.textContent.trim()===${JSON.stringify(label)}||n.getAttribute('aria-label')===${JSON.stringify(label)});if(!n)throw new Error('Missing keyboard target');n.scrollIntoView({block:'center'});n.focus();if(document.activeElement!==n)throw new Error('Focus missing');return true})()`);
    await client.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});
    await client.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  }
  async function capture(name) { const snap=await captureStep(client,'E17-'+name,{assertClean:false});assert(snap.overflowX<=1,`Overflow at ${name}`); return snap; }
  await client.send('Page.navigate',{url:baseUrl+'/routine/records'}); await waitForText(client,'Current owner-applied version 2');
  await tap('Review clearing my applied routine'); await waitForText(client,'Clear the applied routine?');
  await retainAction('Confirm clearing applied routine','__oldClear17');
  await tap('Cancel clearing applied routine'); await tap('Review clearing my applied routine');
  await evaluate(client,'globalThis.__oldClear17()'); await delay(250);
  await waitForText(client,'Current owner-applied version 2'); await waitForText(client,'Clear the applied routine?');
  await capture('clear-review-cancelled-callback-refused');
  await enter('Confirm clearing applied routine'); await waitForText(client,'Applied routine cleared and read back.');
  await client.send('Page.reload'); await waitForText(client,'Applied routine cleared in version 3');
  await tap('Show actual routine and use history'); await waitForText(client,'Cleared applied routine 3'); await waitForText(client,'Applied version 1');
  await capture('clear-reload-history');
  await client.send('Page.navigate',{url:baseUrl+'/today?routine=AM'}); await waitForText(client,'Your applied routine is cleared');
  assert(await evaluate(client,`document.querySelectorAll('[role="checkbox"]').length===0`),'Cleared Today offered routine check-off');
  await waitForText(client,'Record a change (optional)'); await capture('cleared-today-optional-access');
  await tap('You'); await tap('Prepare appointment brief'); await tap('Choose recorded notes and saved plans');
  await tap('Include Cleared actual routine 3',{exact:false});
  await fillByLabel(client,'Questions for the professional','Synthetic17 selected clear question.');
  await tap('Review appointment brief'); await waitForText(client,'Review everything before sharing');
  async function assertReviewStart(stage) {
    const bounds=await evaluate(client, `(()=>{const t=document.querySelector('[aria-label="Reviewed appointment brief"]');const h=[...document.querySelectorAll('[role="heading"]')].find(n=>n.textContent.trim()==='Review everything before sharing');let s=t?.parentElement;while(s&&getComputedStyle(s).overflowY!=='auto'&&getComputedStyle(s).overflowY!=='scroll')s=s.parentElement;return {heading:h?.getBoundingClientRect().toJSON(),text:t?.getBoundingClientRect().toJSON(),scroll:s?.getBoundingClientRect().toJSON(),scrollTop:s?.scrollTop,height:innerHeight}})()`);
    writeJson('E17-review-start-'+stage+'.json',bounds);
    assert(bounds.heading&&bounds.heading.top>=bounds.scroll.top-1&&bounds.heading.bottom<bounds.height&&bounds.text.top<bounds.height-80&&bounds.scrollTop<=1,'Brief review did not start with heading and opening text visible');
  }
  await assertReviewStart('initial');
  await tap('Edit brief selection');
  assert(await evaluate(client,`document.querySelector('[aria-label="Questions for the professional"]')?.value==='Synthetic17 selected clear question.'`),'Review transition lost authored question');
  await waitForText(client,'1 recorded items selected');
  await tap('Review appointment brief'); await waitForText(client,'Review everything before sharing'); await assertReviewStart('reopened');
  const brief=await evaluate(client,`document.querySelector('[aria-label="Reviewed appointment brief"]')?.innerText`);
  assert(brief.includes('This version records no applied products')&&brief.includes('not evidence of non-use'),'Clear provenance missing');
  assert(!brief.includes('Owner-recorded use'),'Clear selection included unselected use');
  await capture('clear-selected-brief'); await tap('Close appointment brief');
  await client.send('Page.navigate',{url:baseUrl+'/routine/records'}); await waitForText(client,'Applied routine cleared in version 3');
  await tap('Review current Shelf sequence as actual routine'); await waitForText(client,'Review before applying');
  await enter('Apply reviewed actual routine'); await waitForText(client,'Current owner-applied version 4');
  await tap('Show actual routine and use history'); await waitForText(client,'Cleared applied routine 3'); await capture('restart-preserves-clear-and-use-history');
  await client.send('Page.navigate',{url:baseUrl+'/today?routine=AM'}); await waitForText(client,'Actual routine version 4');
  assert(await evaluate(client,`document.querySelectorAll('[role="checkbox"]').length>0`),'Restart has no checklist'); await capture('restart-today');
  await client.send('Page.navigate',{url:baseUrl+'/settings/notifications'}); await waitForText(client,'Morning routine');
  await tap('Morning routine',{exact:false}); await waitForCondition(client,`location.pathname==='/settings/timing'`,30000,'Timing navigation');
  await tap('Morning reminder time,',{exact:false}); await waitForText(client,'Morning reminder');
  const captureTime=async key=>evaluate(client,`(()=>{const n=[...document.querySelectorAll('[role="button"]')].find(n=>n.getAttribute('aria-label')==='Morning reminder, 9:30 AM');if(!n)throw new Error('Missing time choice');let f=n[Object.keys(n).find(k=>k.startsWith('__reactFiber$'))];while(f){if(typeof f.memoizedProps?.onPress==='function'){globalThis[${JSON.stringify(key)}]=f.memoizedProps.onPress;return;}f=f.return;}throw new Error('Missing time callback');})()`);
  await captureTime('__cancelledTime17'); await tap('Dismiss time picker'); await tap('Morning reminder time,',{exact:false});
  await evaluate(client,'globalThis.__cancelledTime17()'); await delay(250);
  assert(await evaluate(client,`!!document.querySelector('[aria-label="Dismiss time picker"]')`),'Cancelled picker closed successor');
  await enter('Morning reminder, 9:30 AM'); await waitForText(client,'Preferences saved on this browser. Native reminder scheduling is unavailable here.');
  await capture('timing-keyboard-saved'); await client.send('Page.reload'); await waitForText(client,'9:30 AM');
  const ax=await client.send('Accessibility.getFullAXTree');
  assert(ax.nodes.some(n=>!n.ignored&&n.role?.value==='button'&&n.name?.value==='Morning reminder time, 9:30 AM'),'Saved time missing accessible name');
  await capture('timing-reload');
  writeJson('engineering17-summary.json',{status:'PASS',viewport:await evaluate(client,'({width:innerWidth,height:innerHeight})'),clearCancelledCallbackRefused:true,clearKeyboardAndReload:true,immutableHistory:true,clearedTodayNoCheckoff:true,optionalNotesAccessible:true,selectedClearBrief:true,restartVersion4:true,timingCancelledCallbackRefused:true,timingKeyboardSaveReload:true,briefStartsAtTop:true,briefEditPreservesSelectionAndQuestion:true,native:'NOT_RUN',release:'NO_GO'});
  await client.send('Page.navigate',{url:baseUrl+'/you'}); await waitForText(client,'You');
}
