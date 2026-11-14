import { createElement, useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { NavigationContext } from 'expo-router/build/react-navigation/core/NavigationContext';
import { OnboardingProvider, useOnboarding } from '@/features/onboarding/OnboardingContext';
import * as kv from '@/lib/storage/privateKV';
import * as marker from '@/lib/auth/localAccountIsolation';
import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';
import { activeHealthProcessingLeaseSnapshot, clearActiveHealthProcessingEpoch } from '@/lib/consent/healthProcessingEpoch';
import { assertHealthDataWriteLease, captureHealthDataWriteLease } from '@/lib/consent/healthDataWriteAdmission';
import { grantHealthDataCollectionConsent } from '@/features/onboarding/healthConsent';
import { completeHealthDataActivationRoute, LOCAL_UNCONFIGURED_HEALTH_DATA_OWNER } from '@/features/healthConsent/lifecycle';
import { hasCurrentHealthDataCollectionConsentForLease, hasCurrentHealthDataCollectionConsentStrict } from '@/features/onboarding/healthConsentStore';
import { clearRoutineWidgetActions } from '@/features/widgets/actionRegistry';

// Actual private KV encryption, C46/account/health guards, consent grant/activation,
// widget capability deletion and mounted onboarding run here. Native/rendering ports
// and unexercised selective-cleanup/skin-profile/dependent-consent/photos branches
// are controlled; this is not real cleanup or a Native49 holder attribution.
const native=vi.hoisted(()=>{const bytes=new Map<string,string>();return {bytes,
 getAllKeys:vi.fn(async()=>[...bytes.keys()]),
 getItem:vi.fn(async(key:string)=>bytes.get(key)??null),
 setItem:vi.fn(async(key:string,value:string)=>{bytes.set(key,value);}),
 removeItem:vi.fn(async(key:string)=>{bytes.delete(key);}),
 multiGet:vi.fn(async(keys:readonly string[])=>keys.map(key=>[key,bytes.get(key)??null])),
 multiRemove:vi.fn(async(keys:readonly string[])=>{for(const key of keys)bytes.delete(key);})};});
const secure=vi.hoisted(()=>new Map<string,string>());
vi.mock('@react-native-async-storage/async-storage',()=>({default:native}));
vi.mock('expo-secure-store',()=>({isAvailableAsync:async()=>true,getItemAsync:async(key:string)=>secure.get(key)??null,setItemAsync:async(key:string,value:string)=>{secure.set(key,value);},deleteItemAsync:async(key:string)=>{secure.delete(key);}}));
vi.mock('expo-crypto',async()=>{const c=await import('node:crypto');return {randomUUID:c.randomUUID,CryptoDigestAlgorithm:{SHA256:'SHA256'},digestStringAsync:async(_:string,value:string)=>c.createHash('sha256').update(value).digest('hex')};});
vi.mock('react-native-get-random-values',()=>({}));
vi.mock('react-native',()=>({Platform:{OS:'ios'}}));
vi.mock('@tanstack/react-query',()=>({useQueryClient:()=>({invalidateQueries:vi.fn(async()=>{})})}));
vi.mock('expo-router/build/react-navigation/core/NavigationContext',async()=>({NavigationContext:(await import('react')).createContext(undefined)}));
vi.mock('@/lib/env',()=>({isSupabaseConfigured:false,env:{appEnvironment:'staging'}}));
vi.mock('@/lib/supabase/client',()=>({supabase:{},readPersistedSupabaseSessionCandidate:vi.fn(),getPersistedSupabaseUser:vi.fn(async()=>({data:{user:null}}))}));
vi.mock('@/features/onboarding/skinProfileStore',()=>({setStoredSkinProfileFromExplicitQuiz:vi.fn()}));
vi.mock('@/features/healthConsent/selectiveCleanup',()=>({clearHealthPurposeLocalData:vi.fn(async()=>{})}));
vi.mock('@/lib/consent/dependentConsentLifecycle',()=>({grantHealthDependentConsent:vi.fn(),isHealthDependentConsentActive:vi.fn()}));
vi.mock('@/features/photos/store',()=>({clearPhotos:vi.fn()}));

const KEY='layerwell.healthDataCollectionConsent.v1';
const NAV={isFocused:()=>true,addListener:()=>()=>{}};
let renderer:ReactTestRenderer|null=null;
let latest:ReturnType<typeof useOnboarding>|null=null;
function Probe(){const value=useOnboarding();useEffect(()=>{latest=value;},[value]);return null;}
async function turn(){await act(async()=>{await new Promise<void>(resolve=>setImmediate(resolve));});}
beforeEach(()=>{(globalThis as typeof globalThis&{IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;native.bytes.clear();secure.clear();vi.clearAllMocks();latest=null;native.getItem.mockImplementation(async key=>native.bytes.get(key)??null);native.removeItem.mockImplementation(async key=>{native.bytes.delete(key);});});
afterEach(async()=>{if(renderer)await act(async()=>renderer?.unmount());renderer=null;clearActiveHealthProcessingEpoch();vi.restoreAllMocks();});
async function grantPending(){
 const record=await grantHealthDataCollectionConsent(LOCAL_UNCONFIGURED_HEALTH_DATA_OWNER);
 expect(record.state).toBe('active');expect(record.activationRoutePending).toBe(true);
 expect(activeHealthProcessingLeaseSnapshot()).toBeNull();
 await act(async()=>{renderer=create(createElement(OnboardingProvider,null,createElement(NavigationContext.Provider,{value:NAV as never},createElement(Probe))));});
 return record;
}
it('CONTROL: genuine current grant plus actual mounted-goals activation makes onboarding ready',async()=>{
 const record=await grantPending();
 await act(async()=>{await completeHealthDataActivationRoute({ownerUserId:record.ownerUserId,expectedProcessingEpoch:record.processingEpoch});});
 await turn();
 expect(await hasCurrentHealthDataCollectionConsentStrict()).toBe(true);
 expect(latest!.privacyStatus).toBe('ready');
});
it.each([1,2])('RED: %i real disabled-widget capability clear(s) cannot turn an unchanged durable grant into permanent privacy denial',async clearCount=>{
 const record=await grantPending();
 const durable=native.bytes.get(KEY);expect(durable).toBeDefined();
 let entered!:()=>void;let release!:()=>void;let heldReads=0;
 const readEntered=new Promise<void>(resolve=>{entered=resolve;});
 const held=new Promise<void>(resolve=>{release=resolve;});
 let holding=true;
 native.getItem.mockImplementation(async key=>{const captured=native.bytes.get(key)??null;if(key===KEY&&holding){heldReads++;entered();await held;}return captured;});
 const errors:string[]=[];const original=kv.getPrivateItem;
 vi.spyOn(kv,'getPrivateItem').mockImplementation(key=>{const result=original(key);void result.catch(error=>{errors.push(error instanceof Error?error.message:typeof error);});return result;});
 await act(async()=>{await completeHealthDataActivationRoute({ownerUserId:record.ownerUserId,expectedProcessingEpoch:record.processingEpoch});});
 await readEntered;await turn();
 const originalHealth=captureHealthDataWriteLease();
 const accountBefore=await runAccountGenerationOperation(lease=>lease.generation);
 const generation=marker.privateMutationReadGeneration46();
 await Promise.all(Array.from({length:clearCount},()=>clearRoutineWidgetActions()));
 expect(marker.privateMutationReadGeneration46()).toBeGreaterThan(generation);
 expect(native.bytes.get(KEY)).toBe(durable);
 assertHealthDataWriteLease(originalHealth);
 expect(await runAccountGenerationOperation(lease=>lease.generation)).toBe(accountBefore);
 holding=false;release();await turn();
 const fresh=await hasCurrentHealthDataCollectionConsentStrict();expect(fresh).toBe(true);
 assertHealthDataWriteLease(originalHealth);
 console.log(JSON.stringify({event:'REAL_SOURCE49_CONTROLLED_SCHEDULE',native_cause_claim:false,clearCount,heldReads,
  errors,privateGenerationBefore:generation,privateGenerationAfter:marker.privateMutationReadGeneration46(),
  durableConsentUnchanged:native.bytes.get(KEY)===durable,freshStrictConsent:true,
  originalHealthStillCurrent:true,accountGenerationUnchanged:true,providerPrivacyStatus:latest!.privacyStatus}));
 // Genuine raw C46 refusal is separately asserted below; prepared admission
 // must not convert that guard into absence or permanently deny a valid grant.
 expect(latest!.privacyStatus).toBe('ready');
});


async function readyLease() {
 const record=await grantHealthDataCollectionConsent(LOCAL_UNCONFIGURED_HEALTH_DATA_OWNER);
 await completeHealthDataActivationRoute({ownerUserId:record.ownerUserId,expectedProcessingEpoch:record.processingEpoch});
 return captureHealthDataWriteLease();
}
function deferred(){let release!:()=>void;const promise=new Promise<void>(resolve=>{release=resolve;});return {promise,release};}
function holdConsentRead(){
 const entered=deferred();const held=deferred();let reads=0;
 native.getItem.mockImplementation(async key=>{const captured=native.bytes.get(key)??null;if(key===KEY){reads++;if(reads===1){entered.release();await held.promise;}}return captured;});
 return {entered:entered.promise,release:held.release,reads:()=>reads};
}
it('waits for both known-started fixed-key clears, including second removal before its marker entry',async()=>{
 const lease=await readyLease();const durable=native.bytes.get(KEY);const read=holdConsentRead();
 const pending=hasCurrentHealthDataCollectionConsentForLease(lease);void pending.catch(()=>{});await read.entered;
 const secondEntered=deferred();const secondHeld=deferred();let removals=0;
 native.removeItem.mockImplementation(async key=>{if(key.startsWith('layerwell.widgetActionMap.')){removals++;if(removals>2){secondEntered.release();await secondHeld.promise;}}native.bytes.delete(key);});
 const first=clearRoutineWidgetActions();const second=clearRoutineWidgetActions();await first;await secondEntered.promise;
 read.release();await turn();const beforeSecondSettlement=read.reads();
 secondHeld.release();await second;await expect(pending).resolves.toBe(true);
 expect(beforeSecondSettlement).toBe(1);expect(read.reads()).toBe(2);expect(native.bytes.get(KEY)).toBe(durable);assertHealthDataWriteLease(lease);
});
it('keeps raw consent getters immediately closed across the same genuine generation mismatch',async()=>{
 await readyLease();const read=holdConsentRead();const pending=hasCurrentHealthDataCollectionConsentStrict();void pending.catch(()=>{});
 await read.entered;await clearRoutineWidgetActions();read.release();
 await expect(pending).rejects.toThrow('LOCAL_DATA_PRIVATE_MUTATION_RECOVERY_REQUIRED');expect(read.reads()).toBe(1);
});
it('refuses a copied otherwise-current health lease before native consent IO',async()=>{
 const lease=await readyLease();let reads=0;native.getItem.mockImplementation(async key=>{if(key===KEY)reads++;return native.bytes.get(key)??null;});
 await expect(hasCurrentHealthDataCollectionConsentForLease({...lease})).rejects.toThrow('HEALTH_DATA_WRITE_ADMISSION_CLOSED');expect(reads).toBe(0);
});
it('refuses an original lease after close and identical visible owner/epoch regrant',async()=>{
 const lease=await readyLease();clearActiveHealthProcessingEpoch();
 const epoch=await import('@/lib/consent/healthProcessingEpoch');epoch.setActiveHealthProcessingEpoch(lease.epoch,{ownerUserId:lease.ownerUserId,accountGeneration:lease.accountGeneration});
 let reads=0;native.getItem.mockImplementation(async key=>{if(key===KEY)reads++;return native.bytes.get(key)??null;});
 await expect(hasCurrentHealthDataCollectionConsentForLease(lease)).rejects.toThrow('HEALTH_DATA_WRITE_ADMISSION_CLOSED');expect(reads).toBe(0);
});
it.each(['UNKNOWN_NATIVE49','LOCAL_DATA_PRIVATE_MUTATION_RECOVERY_REQUIRED'])('preserves original native %s error with changed revision and never retries it',async code=>{
 const lease=await readyLease();const entered=deferred();const held=deferred();const failure=new Error(code);let reads=0;
 native.getItem.mockImplementation(async key=>{if(key===KEY){reads++;entered.release();await held.promise;throw failure;}return native.bytes.get(key)??null;});
 const pending=hasCurrentHealthDataCollectionConsentForLease(lease);void pending.catch(()=>{});await entered.promise;
 await clearRoutineWidgetActions();held.release();await expect(pending).rejects.toBe(failure);expect(reads).toBe(1);
});
it('a second independent real retirement closes after exactly two reads without a third',async()=>{
 const lease=await readyLease();const entered=[deferred(),deferred()];const held=[deferred(),deferred()];let reads=0;
 native.getItem.mockImplementation(async key=>{const captured=native.bytes.get(key)??null;if(key===KEY){const index=reads++;if(index<2){entered[index]!.release();await held[index]!.promise;}}return captured;});
 const pending=hasCurrentHealthDataCollectionConsentForLease(lease);void pending.catch(()=>{});await entered[0]!.promise;
 await clearRoutineWidgetActions();held[0]!.release();await entered[1]!.promise;
 await clearRoutineWidgetActions();held[1]!.release();await expect(pending).rejects.toThrow('LOCAL_DATA_PRIVATE_MUTATION_RECOVERY_REQUIRED');expect(reads).toBe(2);
});
it('an orphan marker never admits consent, creates absence, or changes its bytes',async()=>{
 const lease=await readyLease();const durable=native.bytes.get(KEY);const key='layerwell.localDataCleanupRequired.v1';
 const markerRaw=JSON.stringify({v:2,kind:'private-kv-mutations',ownerBinding:null,claims:[{key:'layerwell.completions.v1',nonce:'00000000-0000-4000-8000-000000000001'}]});native.bytes.set(key,markerRaw);
 let reads=0;native.getItem.mockImplementation(async candidate=>{if(candidate===KEY)reads++;return native.bytes.get(candidate)??null;});
 try{await expect(hasCurrentHealthDataCollectionConsentForLease(lease)).rejects.toThrow('LOCAL_DATA_PRIVATE_MUTATION_RECOVERY_REQUIRED');expect(reads).toBe(0);expect(native.bytes.get(key)).toBe(markerRaw);expect(native.bytes.get(KEY)).toBe(durable);}
 finally{native.bytes.delete(key);}
});
it('mounted onboarding joins a pending owned gate before either operation registry, so both drains settle',async()=>{
 const lease=await readyLease();const settle=kv.beginOwnedPrivateKVAccountBoundary39();let reads=0;
 native.getItem.mockImplementation(async key=>{if(key===KEY)reads++;return native.bytes.get(key)??null;});
 await act(async()=>{renderer=create(createElement(OnboardingProvider,null,createElement(NavigationContext.Provider,{value:NAV as never},createElement(Probe))));});
 await turn();expect(latest!.privacyStatus).toBe('checking');expect(reads).toBe(0);
 await (await import('@/lib/auth/accountGeneration')).waitForAccountGenerationOperationsToSettle();await kv.waitForPrivateKVWritesToSettle();
 kv.endPrivateKVAccountBoundary();settle(true);await turn();expect(latest!.privacyStatus).toBe('ready');assertHealthDataWriteLease(lease);
});

it('original purpose closure while waiting for known widget work prevents every renewed raw read',async()=>{
 const lease=await readyLease();const read=holdConsentRead();const pending=hasCurrentHealthDataCollectionConsentForLease(lease);void pending.catch(()=>{});await read.entered;
 await clearRoutineWidgetActions();clearActiveHealthProcessingEpoch();
 const epoch=await import('@/lib/consent/healthProcessingEpoch');epoch.setActiveHealthProcessingEpoch(lease.epoch,{ownerUserId:lease.ownerUserId,accountGeneration:lease.accountGeneration});
 expect(captureHealthDataWriteLease().generation).not.toBe(lease.generation);read.release();
 await expect(pending).rejects.toThrow('HEALTH_DATA_WRITE_ADMISSION_CLOSED');expect(read.reads()).toBe(1);
});
it('an authentic health lease carrying a different account generation never reaches native consent IO',async()=>{
 const lease=await readyLease();clearActiveHealthProcessingEpoch();
 const epoch=await import('@/lib/consent/healthProcessingEpoch');epoch.setActiveHealthProcessingEpoch(lease.epoch,{ownerUserId:lease.ownerUserId,accountGeneration:lease.accountGeneration+1});
 const mismatched=captureHealthDataWriteLease();let reads=0;native.getItem.mockImplementation(async key=>{if(key===KEY)reads++;return native.bytes.get(key)??null;});
 await expect(hasCurrentHealthDataCollectionConsentForLease(mismatched)).rejects.toThrow('HEALTH_DATA_WRITE_ADMISSION_CLOSED');expect(reads).toBe(0);
});
it('Auth A-to-B-to-A during a raw wait cannot lend the new health authority to its old read',async()=>{
 const lease=await readyLease();const read=holdConsentRead();const pending=hasCurrentHealthDataCollectionConsentForLease(lease);void pending.catch(()=>{});await read.entered;
 const account=await import('@/lib/auth/accountGeneration');account.beginAccountGenerationBoundary();account.endAccountGenerationBoundary();account.beginAccountGenerationBoundary();account.endAccountGenerationBoundary();
 const generation=await account.runAccountGenerationOperation(current=>current.generation);
 const epoch=await import('@/lib/consent/healthProcessingEpoch');epoch.setActiveHealthProcessingEpoch(lease.epoch,{ownerUserId:lease.ownerUserId,accountGeneration:generation});read.release();
 await expect(pending).rejects.toThrow();expect(read.reads()).toBe(1);expect(captureHealthDataWriteLease().generation).not.toBe(lease.generation);
});
it('a failed known-started widget removal rejects its waiter with the original failure',async()=>{
 const lease=await readyLease();const read=holdConsentRead();const pending=hasCurrentHealthDataCollectionConsentForLease(lease);void pending.catch(()=>{});await read.entered;
 const held=deferred();const entered=deferred();const failure=new Error('CONTROLLED_WIDGET_REMOVE_FAILURE49');
 native.removeItem.mockImplementation(async key=>{if(key.startsWith('layerwell.widgetActionMap.')){entered.release();await held.promise;throw failure;}native.bytes.delete(key);});
 const clear=clearRoutineWidgetActions();void clear.catch(()=>{});await entered.promise;
 // Retire the raw read through a genuine independent settled generation.
 await marker.clearPrivateMutationAfterRemoval46([]);read.release();await turn();held.release();
 await expect(clear).rejects.toBe(failure);await expect(pending).rejects.toBe(failure);expect(read.reads()).toBe(1);
});

it('a failed live C46 claim remains recovery and cannot be converted into absent or current consent',async()=>{
 const lease=await readyLease();const key='layerwell.completions.v1';
 const token=await runAccountGenerationOperation(current=>marker.armPrivateMutation46(key,current.assertCurrent));marker.abandonPrivateMutation46(token);
 let reads=0;native.getItem.mockImplementation(async candidate=>{if(candidate===KEY)reads++;return native.bytes.get(candidate)??null;});
 await expect(hasCurrentHealthDataCollectionConsentForLease(lease)).rejects.toThrow('LOCAL_DATA_PRIVATE_MUTATION_RECOVERY_REQUIRED');expect(reads).toBe(0);
});
