// USAGE: mkdir -p <out>/shots && node example-capture-messages.js <out>
// Working example for the Message Center guide. Copy it, change pages/selectors.
// Needs the demo site on http://localhost:3010 and the demo admin (bride@demo.local / demo-pass-123).
// See docs/USER_GUIDE_PLAYBOOK.md, section "Capture annotated screenshots".
const {chromium}=require('playwright');
const OUT=process.argv[2]+'/shots/';
const BASE='http://localhost:3010';
async function prep(p){await p.addStyleTag({content:'nextjs-portal,[data-nextjs-toast]{display:none!important}'});}
// modes: tl = top-left corner, r = just right of the element, in = inside right end
async function mark(p,sel,n,mode='tl',nth=0){
  await p.locator(sel).nth(nth).evaluate((el,[n,mode])=>{
    const r=el.getBoundingClientRect();
    let x=r.left-14,y=r.top-14;
    if(mode==='r'){x=r.right+8;y=r.top+r.height/2-14;}
    if(mode==='in'){x=r.right-36;y=r.top+r.height/2-14;}
    if(mode==='l'){x=r.left-36;y=r.top+r.height/2-14;}
    const d=document.createElement('div'); d.className='__badge'; d.textContent=n;
    d.style.cssText=`position:absolute;left:${x+scrollX}px;top:${y+scrollY}px;width:28px;height:28px;border-radius:50%;background:#e11d48;color:#fff;font:700 15px Arial;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.35);border:2px solid #fff;z-index:99999;font-style:normal`;
    document.body.appendChild(d);
  },[String(n),mode]);
}
async function clearMarks(p){await p.evaluate(()=>document.querySelectorAll('.__badge').forEach(e=>e.remove()));}
async function shot(p,name,clip){await p.waitForTimeout(400);await p.screenshot({path:OUT+name+'.png',clip,fullPage:true});console.log('ok',name);}
async function box(p,loc,pad=24){const b=await loc.boundingBox();const sy=await p.evaluate(()=>scrollY);return {x:Math.max(0,b.x-pad),y:Math.max(0,b.y+sy-pad),width:b.width+pad*2,height:b.height+pad*2};}
const card=(p)=>p.locator('#bulk-message').locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]');
async function login(p){await p.goto(BASE+'/admin');await p.fill('input[type=email]','bride@demo.local');await p.fill('input[type=password]','demo-pass-123');await p.click('button[type=submit]');await p.waitForURL('**/dashboard');}
async function msgs(p){await p.goto(BASE+'/admin/messages');await p.waitForSelector('text=recipients');await prep(p);}
(async()=>{
 const b=await chromium.launch();
 const ctx=await b.newContext({viewport:{width:1280,height:900},deviceScaleFactor:2});
 const p=await ctx.newPage();
 await login(p);
 // 01 overview
 await msgs(p);
 await mark(p,'nav a[href="/admin/messages"]',1,'tl');
 await mark(p,'#level',2,'tl');
 await mark(p,'#audience-status',3,'tl');
 await mark(p,'#audience-group',4,'tl');
 await mark(p,'label:has(input[type=checkbox])',5,'in');
 await mark(p,'[role=status]',6,'in');
 await mark(p,'button:has-text("Start sending")',7,'r');
 await shot(p,'01-messages-overview',{x:0,y:0,width:1280,height:560});
 await clearMarks(p);
 await mark(p,'.grid.gap-3 > div',1,'tl',0);
 await shot(p,'02-progress-cards',{x:60,y:160,width:780,height:165});
 // 03 step1 worklist
 await clearMarks(p);
 await p.click('button:has-text("Start sending")');await p.waitForSelector('#bulk-message');
 await p.click('button:has-text("Skip")');await p.waitForTimeout(300);
 await mark(p,'#bulk-message',1,'tl');
 await mark(p,'button:has-text("Open in WhatsApp")',2,'tl');
 await mark(p,'button:has-text("Copy message")',3,'tl');
 await mark(p,'button:has-text("Mark as sent")',4,'tl');
 await mark(p,'button:has-text("Skip")',5,'tl');
 await mark(p,'button:has-text("Stop")',6,'tl');
 await shot(p,'03-worklist-step1',await box(p,card(p)));
 // 04 step 2
 await msgs(p);
 await p.selectOption('#level','guest_code');await p.waitForTimeout(1200);
 await p.click('button:has-text("Start sending")');await p.waitForSelector('#bulk-message');
 await mark(p,'p.-mt-3',1,'l');
 await mark(p,'#bulk-message',2,'tl');
 await shot(p,'04-worklist-step2-code',await box(p,card(p)));
 // 05 step 4
 await msgs(p);
 await p.selectOption('#level','table_update');await p.waitForTimeout(1200);
 await p.click('button:has-text("Start sending")');await p.waitForSelector('#bulk-message');
 await mark(p,'#bulk-message',1,'tl');
 await shot(p,'05-step4-table',await box(p,card(p)));
 // 06 edit template
 await msgs(p);
 await p.click('summary:has-text("Edit the saved template")');await p.waitForTimeout(500);
 await mark(p,'#template-body',1,'tl');
 await mark(p,'button:has-text("Save template")',2,'tl');
 await mark(p,'button:has-text("Reset to default")',3,'tl');
 await shot(p,'06-edit-template',await box(p,p.locator('details').first()));
 // 07 add a second template (groups)
 await msgs(p);
 await mark(p,'button:has-text("Add template")',1,'tl');
 await mark(p,'fieldset legend',2,'r');
 await shot(p,'07-template-groups',await box(p,p.locator('fieldset').locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]')));
 // 08 guests list
 await p.goto(BASE+'/admin/guests');await p.waitForSelector('text=Perera Family');await prep(p);
 await p.screenshot({path:OUT+'08-guests-raw.png',fullPage:true});
 // 09 guest pop-up
 await p.click('button:has-text("+94 77 123 4567")');await p.waitForSelector('[role=dialog]');await p.waitForTimeout(800);
 await mark(p,'[role=tab]',1,'tl',0);
 await mark(p,'[role=dialog] textarea',2,'tl');
 await mark(p,'[role=dialog] input[type=checkbox]',3,'l');
 await mark(p,'[role=dialog] button:has-text("Open in WhatsApp")',4,'tl');
 await shot(p,'09-guest-popup',await box(p,p.locator('[role=dialog]'),30));
 await b.close();
 // phone view
 const b2=await chromium.launch();
 const c2=await b2.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});
 const q=await c2.newPage();await login(q);await msgs(q);
 await q.selectOption('#level','guest_code');await q.waitForTimeout(1200);
 await q.click('button:has-text("Start sending")');await q.waitForSelector('#bulk-message');
 await q.locator('#bulk-message').scrollIntoViewIfNeeded();
 await q.screenshot({path:OUT+'10-phone.png'});console.log('ok phone');
 await b2.close();
})().catch(e=>{console.error(e);process.exit(1)});
