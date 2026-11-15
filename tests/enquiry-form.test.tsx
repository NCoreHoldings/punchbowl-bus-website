// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EnquiryForm } from '../components/enquiry-form';
import type { MapsService } from '../lib/google-maps';
const fakeMaps:MapsService={mapId:'test',suggest:vi.fn(async(input:string)=>[{id:'p1',primary:'Punchbowl Public School',secondary:'Punchbowl NSW',select:async()=>({name:'Punchbowl Public School',address:'1 School Rd, Punchbowl NSW 2196, Australia',lat:-33.92,lng:151.05})}].filter(()=>input.length>=3)),reverse:vi.fn()};
vi.mock('../lib/google-maps',async(orig)=>({...(await orig<typeof import('../lib/google-maps')>()),loadGoogleMaps:vi.fn(async()=>fakeMaps)}));
const receipt={receiptId:'11111111-1111-4111-8111-111111111111',sourceSubmissionId:'client-test',receivedAt:'2035-01-01T00:00:00.000Z'};
afterEach(()=>{cleanup();sessionStorage.clear();vi.unstubAllGlobals();});
function mockedFetch(post:(input:RequestInfo|URL,init?:RequestInit)=>Promise<Response>,available=true,maps:unknown=null){const fn=vi.fn<typeof fetch>().mockImplementation((input,init)=>init?.method==='POST'?post(input,init):Promise.resolve(Response.json({available,maps})));vi.stubGlobal('fetch',fn);return fn;}
async function review(){
 const view=render(<EnquiryForm/>);
 await act(async()=>{});
 const set=(name:string,value:string)=>fireEvent.change(view.container.querySelector(`[name="${name}"]`)!,{target:{value}});
 set('outward-0','10 Learning Street, Sydney NSW 2000');set('outward-1','20 Museum Street, Sydney NSW 2000');set('date','2035-05-14');set('passengerCount','40');
 fireEvent.click(screen.getByRole('button',{name:'Continue'}));
 await screen.findByRole('heading',{name:'Now, a little about you.'});
 set('name','Test coordinator');set('email','coordinator@example.test');
 fireEvent.click(screen.getByRole('button',{name:'Continue'}));
 await screen.findByRole('heading',{name:'Everything looking good?'});
 fireEvent.click(screen.getByRole('checkbox'));
 return view;
}
describe('Customer enquiry submission behaviour',()=>{
 it('prevents duplicate requests while a first click is in flight',async()=>{
  let finish!:(r:Response)=>void;const post=vi.fn(()=>new Promise<Response>(resolve=>{finish=resolve;}));mockedFetch(post);await review();
  const button=screen.getByRole('button',{name:'Send quote request'});fireEvent.click(button);fireEvent.click(button);
  expect(post).toHaveBeenCalledTimes(1);expect((screen.getByRole('button',{name:'Sending request'}) as HTMLButtonElement).disabled).toBe(true);
  await act(async()=>{finish(Response.json(receipt,{status:201}));});await screen.findByRole('heading',{name:'Your request is on its way.'});expect(sessionStorage.length).toBe(0);
 });
 it('locks editing after a network timeout and retries identical bytes',async()=>{
  const post=vi.fn().mockRejectedValueOnce(new DOMException('timeout','TimeoutError')).mockResolvedValueOnce(Response.json(receipt,{status:200}));mockedFetch(post);await review();
  fireEvent.click(screen.getByRole('button',{name:'Send quote request'}));await screen.findByRole('button',{name:'Retry same request'});
  expect((screen.getByRole('button',{name:'Back'}) as HTMLButtonElement).disabled).toBe(true);expect(sessionStorage.length).toBe(1);
  fireEvent.click(screen.getByRole('button',{name:'Retry same request'}));await screen.findByRole('heading',{name:'Your request is on its way.'});
  expect(post.mock.calls[0][1].body).toBe(post.mock.calls[1][1].body);expect(sessionStorage.length).toBe(0);
 });
 it('keeps the original pending request through reload and recovers its receipt',async()=>{
  const post=vi.fn().mockRejectedValueOnce(new TypeError('network')).mockResolvedValueOnce(Response.json(receipt,{status:200}));mockedFetch(post);const view=await review();fireEvent.click(screen.getByRole('button',{name:'Send quote request'}));await screen.findByRole('button',{name:'Retry same request'});view.unmount();
  render(<EnquiryForm/>);await screen.findByText(/A previous request has an unconfirmed result/);fireEvent.click(screen.getByRole('button',{name:'Retry same request'}));await screen.findByRole('heading',{name:'Your request is on its way.'});expect(post.mock.calls[0][1].body).toBe(post.mock.calls[1][1].body);
 });
 it('disables sending when the NCore connection is not configured',async()=>{
  const post=vi.fn();mockedFetch(post,false);await review();expect(screen.getByRole('status').textContent).toContain('Online submission is not connected yet');const button=screen.getByRole('button',{name:'Online sending unavailable'}) as HTMLButtonElement;expect(button.disabled).toBe(true);expect(button.getAttribute('aria-describedby')).toBe('send-unavailable');expect(document.getElementById('send-unavailable')?.textContent).toContain('call');fireEvent.click(button);expect(post).not.toHaveBeenCalled();
 });
 it('enables sending once all required details are complete and the connection is available',async()=>{
  const post=vi.fn(async()=>Response.json(receipt,{status:201}));mockedFetch(post);await review();const button=screen.getByRole('button',{name:'Send quote request'}) as HTMLButtonElement;expect(button.disabled).toBe(false);expect(document.getElementById('send-unavailable')).toBeNull();fireEvent.click(button);await screen.findByRole('heading',{name:'Your request is on its way.'});expect(post).toHaveBeenCalledTimes(1);
 });
 it('adds a passenger stop before the drop-off and sends it in order',async()=>{
  const post=vi.fn(async(_i:RequestInfo|URL,_init?:RequestInit)=>Response.json(receipt,{status:201}));mockedFetch(post);const view=render(<EnquiryForm/>);await act(async()=>{});
  const set=(name:string,value:string)=>fireEvent.change(view.container.querySelector(`[name="${name}"]`)!,{target:{value}});
  set('outward-0','10 Learning Street, Sydney NSW 2000');set('outward-1','20 Museum Street, Sydney NSW 2000');
  fireEvent.click(screen.getByRole('button',{name:/Add passenger stop/}));
  expect(screen.getByText('2. Passenger stop',{selector:'strong'})).toBeTruthy();expect(screen.getByText('3. Drop-off',{selector:'strong'})).toBeTruthy();
  set('date','2035-05-14');set('passengerCount','40');
  fireEvent.click(screen.getByRole('button',{name:'Continue'}));
  expect((await screen.findByRole('alert')).textContent).toMatch(/passenger stop 2/);
  set('outward-1','5 Stop Street, Bankstown NSW 2200');
  fireEvent.click(screen.getByRole('button',{name:'Add coach access notes for 2. Passenger stop'}));fireEvent.change(screen.getByPlaceholderText(/Gate 3/),{target:{value:'Bus bay on Stop Street'}});
  fireEvent.click(screen.getByRole('button',{name:'Continue'}));await screen.findByRole('heading',{name:'Now, a little about you.'});
  set('name','Test coordinator');set('email','coordinator@example.test');
  fireEvent.click(screen.getByRole('button',{name:'Continue'}));await screen.findByRole('heading',{name:'Everything looking good?'});
  fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(screen.getByRole('button',{name:'Send quote request'}));
  await screen.findByRole('heading',{name:'Your request is on its way.'});
  const sent=JSON.parse(post.mock.calls[0][1]!.body as string).payload.forward;
  expect(sent.stops).toEqual([{address:'5 Stop Street, Bankstown NSW 2200',instructions:'Bus bay on Stop Street'}]);expect(sent.destination.address).toBe('20 Museum Street, Sydney NSW 2000');
 });
 it('searches Google Places and fills the venue name and address',async()=>{
  mockedFetch(vi.fn(),true,{key:'test-key',mapId:'test'});render(<EnquiryForm/>);
  const input=await screen.findByRole('combobox',{name:'1. Pickup point'});
  fireEvent.change(input,{target:{value:'Punchbowl Pub'}});
  const option=await screen.findByRole('option',{name:/Punchbowl Public School/});expect(screen.getByText('Powered by Google')).toBeTruthy();
  fireEvent.mouseDown(option);
  await waitFor(()=>expect((input as HTMLInputElement).value).toBe('1 School Rd, Punchbowl NSW 2196, Australia'));
  expect(screen.getByText(/Punchbowl Public School · located on the map/)).toBeTruthy();
 });
 it('honours rate-limit cooldown and retains the pending request',async()=>{
  mockedFetch(async()=>Response.json({error:'Too many attempts.'},{status:429,headers:{'Retry-After':'60'}}));await review();fireEvent.click(screen.getByRole('button',{name:'Send quote request'}));await waitFor(()=>expect((screen.getByRole('button',{name:'Retry in 60s'}) as HTMLButtonElement).disabled).toBe(true));expect(sessionStorage.length).toBe(1);expect((screen.getByRole('button',{name:'Back'}) as HTMLButtonElement).disabled).toBe(true);
 });
});
