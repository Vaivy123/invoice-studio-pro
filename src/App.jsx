import React, { useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { LayoutDashboard, FileText, CreditCard, Users, Settings, Plus, Trash2, Download, Search, Landmark, UserRound, BriefcaseBusiness, CheckCircle2, ShieldCheck, ArrowUpRight, CircleDollarSign, Clock3, Eye, X, ChevronDown, Save, Copy, Check, ReceiptText, CalendarDays, Upload, Mail } from 'lucide-react';
import { calculatePaymentBreakdown } from './invoicePayments.js';

const TODAY = new Date().toISOString().slice(0,10);
const currencies = [
  {code:'INR', label:'Indian Rupee', symbol:'₹'},
  {code:'CAD', label:'Canadian Dollar', symbol:'CA$'},
  {code:'USD', label:'US Dollar', symbol:'$'},
  {code:'EUR', label:'Euro', symbol:'€'},
  {code:'GBP', label:'British Pound', symbol:'£'},
  {code:'AUD', label:'Australian Dollar', symbol:'A$'}
];
const defaultProfile = {
  businessName:'VAISAKH MENON T V',
  email:'',
  phone:'',
  address:'',
  upiId:'',
  upiName:'',
  qrImage:'',
  bankName:'HDFC Bank',
  accountName:'VAISAKH MENON T V',
  accountNumber:'50100636649115',
  ifsc:'HDFC0001569'
};
const blankInvoice = (number='INV-2026-001') => ({
 id: Date.now(), invoiceNo:number, issueDate:TODAY, dueDate:TODAY, currency:'INR', status:'Draft', amountPaid:0, dueNow:'',
 clientName:'', clientEmail:'', clientAddress:'', projectName:'',
 items:[{id:Date.now()+1, description:'Software development', details:'Development, testing and implementation', quantity:1, rate:1000}],
 taxPercent:0, discount:0, notes:'Thank you for your business. Please include the invoice number with your payment.'
});
const fmt = (amount, code='INR') => {
 const c = currencies.find(x=>x.code===code) || currencies[0];
 try { return new Intl.NumberFormat('en-IN',{style:'currency',currency:code,maximumFractionDigits:2}).format(Number(amount||0)); }
 catch { return `${c.symbol}${Number(amount||0).toFixed(2)}`; }
};
const load = (key, fallback) => { try { const v=localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } };
function App(){
 const [profile,setProfile] = useState(()=>({...defaultProfile,...load('isp-profile',{})}));
 const [invoices,setInvoices] = useState(()=>load('isp-invoices',[]));
 const [activeId,setActiveId] = useState(()=>load('isp-invoices',[])[0]?.id || null);
 const [page,setPage] = useState('dashboard');
 const [search,setSearch] = useState('');
 const [notice,setNotice] = useState('');
 const [pdfDownload,setPdfDownload] = useState(null);
 const [showPreview,setShowPreview] = useState(false);
 const [showPayment,setShowPayment] = useState(false);
 const [statusFilter,setStatusFilter] = useState('All');
 const [importingQuotation,setImportingQuotation] = useState(false);
 const quotationInput = useRef(null);
 const active = invoices.find(x=>x.id===activeId) || null;
 const updateActive = fn => setInvoices(old=>old.map(x=>x.id===activeId?fn(x):x));
 const updateField = (key,val) => updateActive(inv=>({...inv,[key]:val}));
 const updateItem = (id,key,val) => updateActive(inv=>({...inv,items:inv.items.map(it=>it.id===id?{...it,[key]:val}:it)}));
 const addItem = () => updateActive(inv=>({...inv,items:[...inv.items,{id:Date.now(),description:'',details:'',quantity:1,rate:0}]}));
 const removeItem = id => updateActive(inv=>({...inv,items:inv.items.length>1?inv.items.filter(it=>it.id!==id):inv.items}));
 const subtotal = active ? active.items.reduce((s,it)=>s+Number(it.quantity||0)*Number(it.rate||0),0) : 0;
 const discount = active ? Math.max(0,Number(active.discount||0)) : 0;
 const taxable = Math.max(0,subtotal-discount);
 const tax = taxable*(Number(active?.taxPercent||0)/100);
 const total = taxable+tax;
 const savedInvoices = invoices.filter(i=>i.status==='Paid').length;
 const outstanding = invoices.filter(i=>i.status!=='Paid').reduce((sum,i)=>sum+calculatePaymentBreakdown(i,calcTotal(i)).balanceBeforeCurrentPayment,0);
 const totalBilled = invoices.reduce((sum,i)=>sum+calcTotal(i),0);
 const activeCurrency = active?.currency || 'INR';
 const payment = active ? calculatePaymentBreakdown(active,total) : null;
 const upiUrl = active && profile.upiId && payment?.dueNow>0 ? `upi://pay?${new URLSearchParams({pa:profile.upiId.trim(),pn:(profile.upiName||profile.businessName).trim(),am:payment.dueNow.toFixed(2),cu:activeCurrency,tn:`Invoice ${active.invoiceNo}`}).toString()}` : '';
 useEffect(()=>{localStorage.setItem('isp-invoices',JSON.stringify(invoices));},[invoices]);
 useEffect(()=>{localStorage.setItem('isp-profile',JSON.stringify(profile));},[profile]);
 useEffect(()=>{if(!pdfDownload)return;return ()=>URL.revokeObjectURL(pdfDownload.url);},[pdfDownload]);
 const flash = msg => {setNotice(msg);window.setTimeout(()=>setNotice(''),4500)};
 function createInvoice(){
   const n = `INV-${new Date().getFullYear()}-${String(invoices.length+1).padStart(3,'0')}`;
   const inv=blankInvoice(n); setInvoices(old=>[inv,...old]);setActiveId(inv.id);setPage('editor');flash('New invoice created');
 }
 async function importQuotation(event){
   const file=event.target.files?.[0];
   event.target.value='';
   if(!file)return;
   setImportingQuotation(true);
   try{
     const {readQuotationPdf}=await import('./quotationImport.js');
     const quotation=await readQuotationPdf(file);
     const n=`INV-${new Date().getFullYear()}-${String(invoices.length+1).padStart(3,'0')}`;
     const invoice={...blankInvoice(n),...quotation,id:Date.now(),status:'Draft'};
     setInvoices(old=>[invoice,...old]);setActiveId(invoice.id);setPage('editor');
     flash('Draft invoice created. Review the imported details before sending.');
   }catch(error){
     flash(error instanceof Error ? error.message : 'Could not read the quotation PDF.');
   }finally{
     setImportingQuotation(false);
   }
 }
 function duplicateInvoice(inv){
   const copy={...inv,id:Date.now(),invoiceNo:`INV-${new Date().getFullYear()}-${String(invoices.length+1).padStart(3,'0')}`,status:'Draft',amountPaid:0,dueNow:'',items:inv.items.map(i=>({...i,id:Date.now()+Math.random()}))};
   setInvoices(old=>[copy,...old]);setActiveId(copy.id);setPage('editor');flash('Invoice duplicated');
 }
 function deleteInvoice(id){
   if(!confirm('Delete this invoice permanently from this browser?'))return;
   const next=invoices.filter(i=>i.id!==id);setInvoices(next);setActiveId(next[0]?.id||null);setPage('invoices');flash('Invoice deleted');
 }
 function markStatus(status){
   const paymentDetails=active&&calculatePaymentBreakdown(active,calcTotal(active));
   if(status==='Paid'&&paymentDetails?.balanceBeforeCurrentPayment>0){
     flash('Record the remaining payments before marking this invoice Paid.');
     return;
   }
   updateField('status',status);flash(`Invoice marked ${status.toLowerCase()}`);
 }
 function emailInvoice(invoice){
   const recipient=invoice.clientEmail.trim();
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)){
     flash('Add a valid client email address in Client details first.');
     return;
   }
   const subject=`Invoice ${invoice.invoiceNo} from ${profile.businessName||'Your business'}`;
   const invoiceTotal=calcTotal(invoice);
   const paymentDetails=calculatePaymentBreakdown(invoice,invoiceTotal);
   const body=[
     `Hello ${invoice.clientName||'there'},`,
     '',
     `Please find the invoice details below for ${invoice.projectName||invoice.invoiceNo}.`,
     `Invoice: ${invoice.invoiceNo}`,
     `Project total: ${fmt(invoiceTotal,invoice.currency)}`,
     `Initial payment received: -${fmt(paymentDetails.previouslyPaid,invoice.currency)}`,
     `Balance after initial payment: ${fmt(paymentDetails.balanceBeforeCurrentPayment,invoice.currency)}`,
     `Amount paying now: ${fmt(paymentDetails.dueNow,invoice.currency)}`,
     `Balance remaining after this payment: ${fmt(paymentDetails.remainingAfterCurrentPayment,invoice.currency)}`,
     `Due date: ${invoice.dueDate||'Not specified'}`,
     '',
     'Please attach the invoice PDF before sending this email.',
     '',
     `Thank you,`,
     profile.businessName||'Your business'
   ].join('\n');
   window.location.href=`mailto:${encodeURIComponent(recipient)}?${new URLSearchParams({subject,body}).toString()}`;
   flash('Opening your email app. Attach the invoice PDF before sending.');
 }
 async function downloadActivePdf(){
   if(!active)return;
   try{
     const { downloadInvoicePdf } = await import('./invoicePdf.js');
     const {blob,filename}=await downloadInvoicePdf({invoice:active,profile,subtotal:calcSubtotal(active),tax:calcTax(active),total:calcTotal(active),payment:calculatePaymentBreakdown(active,calcTotal(active)),upiUrl});
     const url=URL.createObjectURL(blob);
     setPdfDownload({url,filename});
     const link=document.createElement('a');
     link.href=url;
     link.download=filename;
     document.body.append(link);
     link.click();
     link.remove();
   }catch(error){
     flash(error instanceof Error ? `Could not download the invoice PDF: ${error.message}` : 'Could not download the invoice PDF.');
   }
 }
 function newProfileField(k,v){setProfile(p=>({...p,[k]:v}));}
 const filtered = invoices.filter(inv=>(statusFilter==='All'||inv.status===statusFilter)&&`${inv.invoiceNo} ${inv.clientName} ${inv.projectName}`.toLowerCase().includes(search.toLowerCase()));
 return <div className="app">
  <aside className="sidebar no-print">
   <div className="brand"><img className="brand-logo" src="/invoice-studio-logo.svg" alt="Invoice Studio — Freelance Workspace"/><img className="brand-mark" src="/invoice-studio-mark.svg" alt="Invoice Studio"/></div>
   <div className="nav-caption">WORKSPACE</div>
   <Nav active={page==='dashboard'} icon={<LayoutDashboard size={18}/>} onClick={()=>setPage('dashboard')}>Dashboard</Nav>
   <Nav active={page==='invoices'||page==='editor'} icon={<FileText size={18}/>} onClick={()=>setPage('invoices')}>Invoices <span className="nav-count">{invoices.length}</span></Nav>
   <Nav active={page==='clients'} icon={<Users size={18}/>} onClick={()=>setPage('clients')}>Clients</Nav>
   <div className="nav-caption second">PREFERENCES</div>
   <Nav active={page==='payments'} icon={<CreditCard size={18}/>} onClick={()=>setPage('payments')}>Payment setup</Nav>
   <Nav active={page==='settings'} icon={<Settings size={18}/>} onClick={()=>setPage('settings')}>Business profile</Nav>
   <div className="side-bottom"><div className="privacy-card"><ShieldCheck size={17}/><strong>Private by default</strong><p>Data stays in this browser. Export or back up your invoices regularly.</p></div><div className="user-chip"><div className="avatar">{(profile.businessName||'Y').slice(0,1).toUpperCase()}</div><div><strong>{profile.businessName||'Your business'}</strong><small>Freelance account</small></div></div></div>
  </aside>
  <main className="main">
   <header className="topbar no-print"><div className="crumb">WORKSPACE <span>/</span> {page==='editor'?'INVOICE EDITOR':page.toUpperCase()}</div><div className="top-right"><span className="local-badge"><span/> Local data</span><button className="btn btn-primary" onClick={createInvoice}><Plus size={16}/> New invoice</button></div></header>
   {page==='dashboard' && <Dashboard invoices={invoices} totalBilled={totalBilled} outstanding={outstanding} savedInvoices={savedInvoices} onCreate={createInvoice} onOpen={inv=>{setActiveId(inv.id);setPage('editor')}} onAll={()=>setPage('invoices')}/>}
   {page==='invoices' && <section><PageHeading title="Invoices" subtitle="Create, manage and track your freelance project billing." action={<div className="invoice-create-actions"><input ref={quotationInput} className="visually-hidden" type="file" accept="application/pdf,.pdf" onChange={importQuotation}/><button className="btn btn-light" disabled={importingQuotation} onClick={()=>quotationInput.current?.click()}><Upload size={15}/>{importingQuotation?'Reading PDF...':'Import quotation PDF'}</button><button className="btn btn-primary" onClick={createInvoice}><Plus size={16}/> Create invoice</button></div>}/><p className="import-hint">Import a text-based quotation PDF to create a draft invoice. Check every field and amount before sending.</p><div className="toolbar"><div className="searchbox"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search invoice, client or project..."/></div><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option>All</option><option>Draft</option><option>Sent</option><option>Paid</option><option>Overdue</option></select></div><InvoiceList invoices={filtered} onOpen={inv=>{setActiveId(inv.id);setPage('editor')}} onDuplicate={duplicateInvoice} onDelete={deleteInvoice}/></section>}
   {page==='editor' && (active ? <Editor active={active} profile={profile} total={calcTotal(active)} payment={payment} subtotal={calcSubtotal(active)} tax={calcTax(active)} onChange={updateField} onItem={updateItem} onAdd={addItem} onRemove={removeItem} onBack={()=>setPage('invoices')} onSave={()=>{flash('Invoice auto-saved in this browser')}} onDownload={downloadActivePdf} onPreview={()=>setShowPreview(true)} onEmail={()=>emailInvoice(active)} onPayments={()=>setShowPayment(true)} onStatus={markStatus} onDelete={()=>deleteInvoice(active.id)} onDuplicate={()=>duplicateInvoice(active)} upiUrl={upiUrl}/> : <Empty title="No invoice selected" text="Create a new invoice to get started." action={createInvoice}/>)}
   {page==='payments' && <PaymentSetup profile={profile} set={newProfileField} save={()=>flash('Payment settings saved in this browser')}/>}
   {page==='settings' && <ProfileSetup profile={profile} set={newProfileField} save={()=>flash('Business profile saved')}/>}
   {page==='clients' && <Clients invoices={invoices} onOpen={inv=>{setActiveId(inv.id);setPage('editor')}} onCreate={createInvoice}/>}
  </main>
  {notice && <div className="toast"><CheckCircle2 size={17}/>{notice}</div>}
  {pdfDownload && <div className="pdf-ready" role="status"><span>Invoice PDF is ready.</span><a href={pdfDownload.url} download={pdfDownload.filename}><Download size={15}/> Download PDF</a></div>}
  {showPreview&&active&&<Modal title="Invoice preview" close={()=>setShowPreview(false)} wide><div className="modal-actions no-print"><button className="btn btn-primary" onClick={downloadActivePdf}><Download size={15}/> Download PDF</button><button className="btn btn-light" onClick={()=>setShowPreview(false)}>Done</button></div><InvoicePaper invoice={active} profile={profile} total={total} payment={payment} subtotal={subtotal} tax={tax} upiUrl={upiUrl}/></Modal>}
  {showPayment&&active&&<Modal title="Payment instructions" close={()=>setShowPayment(false)}><div className="payment-modal"><p>These details will appear on the invoice PDF. Verify all details before sharing.</p>{(profile.qrImage || upiUrl) && <div className="qr-center">{profile.qrImage ? <img src={profile.qrImage} alt="Custom QR code" style={{width:150,height:150,objectFit:'contain',borderRadius:8,border:'1px solid #e8ebf2',background:'#fff'}}/> : <QRCodeSVG value={upiUrl} size={150} includeMargin/>}<strong>{profile.upiId}</strong><small>UPI · {fmt(payment?.dueNow||0,active.currency)}</small></div>}<BankDetails profile={profile}/><button className="btn btn-primary full" onClick={()=>{setShowPayment(false);flash('Payment instructions are included in the invoice preview')}}>Done</button></div></Modal>}
 </div>;
}
function calcSubtotal(inv){return inv.items.reduce((s,it)=>s+Number(it.quantity||0)*Number(it.rate||0),0)}
function calcTax(inv){return Math.max(0,calcSubtotal(inv)-Number(inv.discount||0))*Number(inv.taxPercent||0)/100}
function calcTotal(inv){return Math.max(0,calcSubtotal(inv)-Number(inv.discount||0))+calcTax(inv)}
function Nav({active,icon,children,onClick}){return <button className={`nav-item ${active?'active':''}`} onClick={onClick}>{icon}<span>{children}</span></button>}
function PageHeading({title,subtitle,action}){return <div className="page-heading"><div><h1>{title}</h1><p>{subtitle}</p></div>{action}</div>}
function StatCard({label,value,sub,icon,tone}){return <div className="stat-card"><div className={`stat-icon ${tone}`}>{icon}</div><span>{label}</span><strong>{value}</strong><small>{sub}</small></div>}
function Dashboard({invoices,totalBilled,outstanding,savedInvoices,onCreate,onOpen,onAll}){
 const recent=invoices.slice(0,5);
 return <section><div className="welcome"><div><div className="eyebrow">YOUR FREELANCE FINANCES</div><h1>Good work deserves<br/><em>good invoicing.</em></h1><p>Keep project billing organized, make payment easy, and spend more time building.</p><button className="btn btn-primary" onClick={onCreate}><Plus size={16}/> Create an invoice</button></div><div className="welcome-art"><div className="art-circle"><ReceiptText size={62}/></div><div className="float-chip chip-one"><CheckCircle2 size={16}/> Payment-ready invoices</div><div className="float-chip chip-two"><CreditCard size={16}/> UPI + bank transfer</div></div></div>
 <div className="stats-grid"><StatCard label="TOTAL INVOICED" value={fmt(totalBilled,'INR')} sub={`${invoices.length} invoice${invoices.length===1?'':'s'} · totals shown as entered`} icon={<CircleDollarSign size={20}/>} tone="violet"/><StatCard label="OUTSTANDING" value={fmt(outstanding,'INR')} sub="Unpaid invoices, mixed currencies not converted" icon={<Clock3 size={20}/>} tone="amber"/><StatCard label="PAID INVOICES" value={savedInvoices} sub="Marked paid by you" icon={<CheckCircle2 size={20}/>} tone="green"/></div>
 <div className="section-header"><div><h2>Recent invoices</h2><p>Your latest project billing activity.</p></div><button className="text-button" onClick={onAll}>View all <ArrowUpRight size={15}/></button></div>
 {recent.length ? <InvoiceList invoices={recent} onOpen={onOpen} compact/> : <Empty title="Your first invoice starts here" text="Add a client, describe your work, then share a polished invoice with UPI and bank payment instructions." action={onCreate}/>}
 <div className="tip-banner"><div className="tip-icon"><ShieldCheck size={19}/></div><div><strong>Quick reminder for payment safety</strong><p>A UPI QR code is a payment request, not confirmation of payment. Verify incoming payments in your bank or UPI app before marking an invoice as paid.</p></div></div>
 </section>;
}
function InvoiceList({invoices,onOpen,onDuplicate,onDelete,compact=false}){
 if(!invoices.length)return <div className="empty-list">No invoices match your search.</div>;
 return <div className="table-card"><div className="table-scroll"><table className="data-table"><thead><tr><th>INVOICE</th><th>CLIENT / PROJECT</th><th>ISSUED</th><th>PAYING NOW</th><th>STATUS</th><th></th></tr></thead><tbody>{invoices.map(inv=><tr key={inv.id} onClick={()=>onOpen(inv)}><td><strong>{inv.invoiceNo}</strong><small>{inv.currency}</small></td><td><strong>{inv.clientName||'Unnamed client'}</strong><small>{inv.projectName||inv.items[0]?.description||'Project work'}</small></td><td>{inv.issueDate||'—'}</td><td className="money-cell">{fmt(calculatePaymentBreakdown(inv,calcTotal(inv)).dueNow,inv.currency)}</td><td><Status status={inv.status}/></td><td><button className="row-action" title="Open invoice" onClick={e=>{e.stopPropagation();onOpen(inv)}}><ArrowUpRight size={16}/></button></td></tr>)}</tbody></table></div></div>;
}
function Status({status}){return <span className={`status status-${String(status).toLowerCase()}`}>{status}</span>}
function Empty({title,text,action}){return <div className="empty-state"><div className="empty-icon"><FileText size={26}/></div><h3>{title}</h3><p>{text}</p>{action&&<button className="btn btn-primary" onClick={action}><Plus size={16}/> Create invoice</button>}</div>}
function Editor({active,profile,total,payment,subtotal,tax,onChange,onItem,onAdd,onRemove,onBack,onSave,onDownload,onPreview,onEmail,onPayments,onStatus,onDelete,onDuplicate,upiUrl}){
 const set=(k,v)=>onChange(k,v);
 const discount=Math.max(0,Number(active.discount||0));
 function setPaymentAmount(key,value){
  if(value===''){
   set(key,key==='dueNow'?'':0);
   return;
  }
  const max=key==='amountPaid'?total:Math.max(0,total-payment.previouslyPaid);
  const amount=Math.min(Math.max(0,Number(value)||0),max);
  if(key==='amountPaid'){
   onChange('amountPaid',amount);
   if(active.dueNow!=null&&active.dueNow!==''){
    onChange('dueNow',Math.min(amount===total?0:Math.max(0,total-amount),Math.max(0,Number(active.dueNow)||0)));
   }
   return;
  }
  set(key,amount);
 }
 return <section className="editor-page"><div className="editor-head no-print"><button className="back-link" onClick={onBack}>← All invoices</button><div className="editor-actions"><button className="btn btn-light" onClick={onDuplicate}><Copy size={15}/> Duplicate</button><button className="btn btn-light" onClick={onPreview}><Eye size={15}/> Preview</button><button className="btn btn-light" disabled={!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(active.clientEmail||'')} title={active.clientEmail?'Open a prefilled email for this invoice':'Add a valid client email in Client details first'} onClick={onEmail}><Mail size={15}/> Email invoice</button><button className="btn btn-primary" onClick={()=>{onSave();onDownload()}}><Download size={15}/> Download PDF</button></div></div>
 <PageHeading title={active.invoiceNo} subtitle="Edit invoice details, project work, rates and payment methods." action={<Status status={active.status}/>}/>
 <div className="editor-layout"><div className="edit-forms">
  <div className="panel"><PanelHeading icon={<FileText size={18}/>} title="Invoice details" desc="Invoice number, dates and currency."/><div className="form-grid"><Field label="Invoice number" value={active.invoiceNo} onChange={v=>set('invoiceNo',v)}/><Field label="Project / engagement" value={active.projectName} onChange={v=>set('projectName',v)} placeholder="e.g. Website development"/><Field label="Issue date" value={active.issueDate} onChange={v=>set('issueDate',v)} type="date"/><Field label="Due date" value={active.dueDate} onChange={v=>set('dueDate',v)} type="date"/><Field label="Invoice currency" value={active.currency} onChange={v=>set('currency',v)} select options={currencies.map(c=>[c.code,`${c.code} — ${c.label}`])}/><Field label="Status" value={active.status} onChange={onStatus} select options={['Draft','Sent','Paid','Overdue'].map(s=>[s,s])}/></div></div>
  <div className="panel"><PanelHeading icon={<UserRound size={18}/>} title="Client details" desc="Who is this invoice for?"/><div className="form-grid"><Field label="Client / company name" value={active.clientName} onChange={v=>set('clientName',v)} placeholder="Client or company"/><Field label="Client email" value={active.clientEmail} onChange={v=>set('clientEmail',v)} placeholder="client@example.com" type="email"/><Field label="Billing address" value={active.clientAddress} onChange={v=>set('clientAddress',v)} placeholder="Client billing address" wide/></div></div>
  <div className="panel"><PanelHeading icon={<BriefcaseBusiness size={18}/>} title="Work items" desc="Bill by hours, days, milestones or other units."/><div className="line-head"><span>DESCRIPTION</span><span>QTY / HRS</span><span>RATE ({active.currency})</span><span>AMOUNT</span><span/></div>{active.items.map(item=><div className="line-edit" key={item.id}><div className="line-description"><input value={item.description} onChange={e=>onItem(item.id,'description',e.target.value)} placeholder="Development, bug fixes, consultation..."/><input className="detail-input" value={item.details} onChange={e=>onItem(item.id,'details',e.target.value)} placeholder="Optional detail / deliverable"/></div><input type="number" min="0" step=".25" value={item.quantity} onChange={e=>onItem(item.id,'quantity',e.target.value)}/><input type="number" min="0" step=".01" value={item.rate} onChange={e=>onItem(item.id,'rate',e.target.value)}/><strong>{fmt(Number(item.quantity||0)*Number(item.rate||0),active.currency)}</strong><button className="remove-line" title="Remove item" onClick={()=>onRemove(item.id)}><Trash2 size={15}/></button></div>)}<button className="add-row" onClick={onAdd}><Plus size={15}/> Add work item</button>
   <div className="calc-box"><div className="calc-fields"><Field label="Discount amount" value={active.discount} onChange={v=>set('discount',v)} type="number"/><Field label="Tax / GST (%)" value={active.taxPercent} onChange={v=>set('taxPercent',v)} type="number"/><Field label="Initial payment received" value={payment.previouslyPaid} onChange={v=>setPaymentAmount('amountPaid',v)} type="number" min="0" max={total}/><Field label="Amount paying now" value={active.dueNow??''} onChange={v=>setPaymentAmount('dueNow',v)} type="number" min="0" max={Math.max(0,total-payment.previouslyPaid)} placeholder="Enter amount to collect"/></div><div className="calc-row"><span>Subtotal</span><strong>{fmt(subtotal,active.currency)}</strong></div>{discount>0&&<div className="calc-row"><span>Discount</span><strong>−{fmt(discount,active.currency)}</strong></div>}<div className="calc-row"><span>Tax ({Number(active.taxPercent||0)}%)</span><strong>{fmt(tax,active.currency)}</strong></div><div className="calc-row final"><span>Project total</span><strong>{fmt(total,active.currency)}</strong></div><div className="calc-row payment-deduction"><span>Initial payment received</span><strong>−{fmt(payment.previouslyPaid,active.currency)}</strong></div><div className="calc-row"><span>Balance before this payment</span><strong>{fmt(payment.balanceBeforeCurrentPayment,active.currency)}</strong></div><div className="calc-row installment-now"><span>Amount paying now</span><strong>{fmt(payment.dueNow,active.currency)}</strong></div><div className="calc-row"><span>Balance remaining after this payment</span><strong>{fmt(payment.remainingAfterCurrentPayment,active.currency)}</strong></div></div>
  </div>
  <div className="panel"><PanelHeading icon={<CreditCard size={18}/>} title="Payment & notes" desc="Payment instructions are included in the invoice preview."/><div className="payment-short"><div><div className="mini-icon violet"><CreditCard size={17}/></div><div><strong>UPI QR code</strong><small>{profile.upiId||'Add your UPI ID in Payment setup'}</small></div></div><div><div className="mini-icon green"><Landmark size={17}/></div><div><strong>Bank transfer</strong><small>{profile.bankName||'Add bank details in Payment setup'}</small></div></div><button className="btn btn-light" onClick={onPayments}>Manage payment details <ArrowUpRight size={14}/></button></div><Field label="Notes / payment terms" value={active.notes} onChange={v=>set('notes',v)} multiline placeholder="Payment terms, thanks, reference number..."/></div>
  <div className="editor-bottom no-print"><button className="btn btn-danger" onClick={onDelete}><Trash2 size={15}/> Delete invoice</button><button className="btn btn-primary" onClick={onSave}><CheckCircle2 size={15}/> Save invoice</button></div>
 </div><aside className="preview-side"><div className="preview-sticky"><div className="preview-side-head"><div><span className="eyebrow">LIVE PREVIEW</span><h3>Client-ready invoice</h3></div><button className="icon-button" onClick={onPreview}><Eye size={17}/></button></div><InvoicePaper invoice={active} profile={profile} total={total} payment={payment} subtotal={subtotal} tax={tax} upiUrl={upiUrl}/><button className="btn btn-primary full no-print" onClick={onPreview}><Eye size={15}/> Open full preview</button><p className="safe-note"><ShieldCheck size={14}/> Verify payment in your banking app before marking Paid.</p></div></aside></div>
 </section>;
}
function PanelHeading({icon,title,desc}){return <div className="panel-heading"><div className="panel-icon">{icon}</div><div><h3>{title}</h3><p>{desc}</p></div></div>}
function Field({label,value,onChange,placeholder='',type='text',multiline=false,select=false,options=[],wide=false,min,max}){
 return <label className={`field ${wide?'wide':''}`}><span>{label}</span>{select?<select value={value??''} onChange={e=>onChange(e.target.value)}>{options.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>:multiline?<textarea value={value??''} onChange={e=>onChange(e.target.value)} rows="3" placeholder={placeholder}/>:<input type={type} min={min} max={max} step={type==='number'?'any':undefined} value={value??''} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/>}</label>;
}
function PaymentSetup({profile,set,save}){
 const uploadQr = (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => set('qrImage', String(reader.result || ''));
  reader.readAsDataURL(file);
 };
 return <section><PageHeading title="Payment setup" subtitle="Configure UPI and bank transfer details that appear on your client invoices."/><div className="settings-grid"><div className="panel"><PanelHeading icon={<CreditCard size={18}/>} title="UPI payment" desc="A scannable payment request is generated for each invoice amount."/><Field label="UPI ID / VPA" value={profile.upiId} onChange={v=>set('upiId',v)} placeholder="yourname@bank"/><Field label="UPI account holder name" value={profile.upiName} onChange={v=>set('upiName',v)} placeholder="Name shown in UPI app"/><label className="field"><span>Custom QR code image</span><input type="file" accept="image/*" onChange={uploadQr}/></label>{profile.qrImage && <div className="qr-settings"><img src={profile.qrImage} alt="Custom QR code" style={{width:126,height:126,objectFit:'contain',borderRadius:8,border:'1px solid #e8ebf2',background:'#fff'}}/><button className="btn btn-light" type="button" onClick={()=>set('qrImage','')}>Remove custom QR</button></div>}{!profile.qrImage && profile.upiId && <div className="qr-settings"><QRCodeSVG value={`upi://pay?${new URLSearchParams({pa:profile.upiId,pn:profile.upiName||profile.businessName,cu:'INR'}).toString()}`} size={126} includeMargin/><div><strong>Test your UPI QR</strong><p>Scan with your UPI app and verify the payee name before sharing invoices.</p></div></div>}<div className="notice"><ShieldCheck size={17}/><span>Do not enter a UPI PIN, OTP, card PIN or banking password. This app does not collect or process payments.</span></div></div><div className="panel"><PanelHeading icon={<Landmark size={18}/>} title="Bank transfer" desc="For NEFT, IMPS or other supported bank transfers."/><Field label="Account holder name" value={profile.accountName} onChange={v=>set('accountName',v)} placeholder="Name registered with bank"/><Field label="Bank name" value={profile.bankName} onChange={v=>set('bankName',v)} placeholder="Bank name"/><Field label="Account number" value={profile.accountNumber} onChange={v=>set('accountNumber',v)} placeholder="Bank account number"/><Field label="IFSC code" value={profile.ifsc} onChange={v=>set('ifsc',v.toUpperCase())} placeholder="IFSC code"/><p className="helper-text">Only include bank details you are comfortable sharing with clients. The information is stored locally in this browser.</p></div></div><button className="btn btn-primary" onClick={save}><Save size={16}/> Save payment details</button></section>;
}
function ProfileSetup({profile,set,save}){
 return <section><PageHeading title="Business profile" subtitle="Your details appear at the top of each invoice."/><div className="panel profile-panel"><PanelHeading icon={<BriefcaseBusiness size={18}/>} title="Freelancer details" desc="Use your legal or registered business details where applicable."/><div className="form-grid"><Field label="Your name / business name" value={profile.businessName} onChange={v=>set('businessName',v)} placeholder="Name or business"/><Field label="Email address" value={profile.email} onChange={v=>set('email',v)} placeholder="you@example.com" type="email"/><Field label="Phone" value={profile.phone} onChange={v=>set('phone',v)} placeholder="+91 ..."/><Field label="Business address" value={profile.address} onChange={v=>set('address',v)} placeholder="City, state, PIN code" wide/></div><button className="btn btn-primary" onClick={save}><Save size={16}/> Save business profile</button></div><div className="notice wide-notice"><ShieldCheck size={17}/><span>Your profile and invoices are stored in this browser only. Use a personal device, and back up your invoices if you need to retain them.</span></div></section>;
}
function Clients({invoices,onOpen,onCreate}){
 const map=new Map();invoices.forEach(inv=>{const key=(inv.clientName||'Unnamed client').trim();const old=map.get(key)||{name:key,email:inv.clientEmail,count:0,total:0,latest:inv};old.count++;old.total+=calcTotal(inv);if(inv.issueDate>(old.latest.issueDate||''))old.latest=inv;map.set(key,old)});
 const clients=[...map.values()].sort((a,b)=>a.name.localeCompare(b.name));
 return <section><PageHeading title="Clients" subtitle="A client list is built automatically from the invoices you create." action={<button className="btn btn-primary" onClick={onCreate}><Plus size={16}/> New invoice</button>}/>{clients.length?<div className="client-grid">{clients.map(c=><div className="client-card" key={c.name}><div className="client-avatar">{c.name.slice(0,1).toUpperCase()}</div><h3>{c.name}</h3><p>{c.email||'No email added'}</p><div className="client-stats"><div><small>INVOICES</small><strong>{c.count}</strong></div><div><small>INVOICE TOTAL</small><strong>{fmt(c.total,c.latest.currency)}</strong></div></div><button className="btn btn-light full" onClick={()=>onOpen(c.latest)}>Open latest invoice <ArrowUpRight size={14}/></button></div>)}</div>:<Empty title="Your clients will appear here" text="Create your first invoice and the client will be added to this list automatically." action={onCreate}/>}</section>;
}
function BankDetails({profile}){
 if(!profile.accountNumber&&!profile.ifsc&&!profile.bankName)return <div className="empty-bank">Bank transfer details not configured yet.</div>;
 return <div className="bank-details-modal">{[['Account name',profile.accountName||profile.businessName],['Bank',profile.bankName],['Account number',profile.accountNumber],['IFSC',profile.ifsc]].filter(x=>x[1]).map(([k,v])=><div key={k}><span>{k}</span><strong>{v}</strong></div>)}</div>;
}
function InvoicePaper({invoice,profile,total,payment,subtotal,tax,upiUrl}){
 const discount=Math.max(0,Number(invoice.discount||0));
 return <article className="invoice-paper">
  <div className="paper-head">
   <div>
    <div className="paper-logo"><ReceiptText size={16}/></div>
    <h3>{profile.businessName||'Your Business'}</h3>
    {profile.address&&<p>{profile.address}</p>}
    {(profile.email||profile.phone)&&<p>{[profile.email,profile.phone].filter(Boolean).join(' · ')}</p>}
   </div>
   <div className="paper-invoice-title"><span>INVOICE</span><strong>{invoice.invoiceNo}</strong><small>ISSUED {invoice.issueDate||'—'}</small><small>DUE {invoice.dueDate||'—'}</small></div>
  </div>
  <div className="paper-rule"/>
  <div className="paper-meta">
   <div><label>BILL TO</label><strong>{invoice.clientName||'Client name'}</strong>{invoice.clientEmail&&<p>{invoice.clientEmail}</p>}{invoice.clientAddress&&<p>{invoice.clientAddress}</p>}</div>
   <div><label>PROJECT</label><strong>{invoice.projectName||invoice.items[0]?.description||'Project work'}</strong><p>Currency: {invoice.currency}</p></div>
  </div>
  <table className="paper-table">
   <thead><tr><th>DESCRIPTION</th><th>QTY</th><th>RATE</th><th>AMOUNT</th></tr></thead>
   <tbody>{invoice.items.map(item=><tr key={item.id}><td><strong>{item.description||'Work item'}</strong>{item.details&&<small>{item.details}</small>}</td><td>{Number(item.quantity||0)}</td><td>{fmt(item.rate,invoice.currency)}</td><td>{fmt(Number(item.quantity||0)*Number(item.rate||0),invoice.currency)}</td></tr>)}</tbody>
  </table>
  <div className="paper-totals">
   <div><span>Subtotal</span><strong>{fmt(subtotal,invoice.currency)}</strong></div>
   {discount>0&&<div><span>Discount</span><strong>−{fmt(discount,invoice.currency)}</strong></div>}
   <div><span>Tax ({Number(invoice.taxPercent||0)}%)</span><strong>{fmt(tax,invoice.currency)}</strong></div>
   <div><span>Project total</span><strong>{fmt(total,invoice.currency)}</strong></div>
   <div className="paper-deduction"><span>Initial payment received</span><strong>−{fmt(payment.previouslyPaid,invoice.currency)}</strong></div>
   <div><span>Balance before this payment</span><strong>{fmt(payment.balanceBeforeCurrentPayment,invoice.currency)}</strong></div>
   <div><span>Balance remaining after payment</span><strong>{fmt(payment.remainingAfterCurrentPayment,invoice.currency)}</strong></div>
   <div className="paper-grand"><span>Amount paying now</span><strong>{fmt(payment.dueNow,invoice.currency)}</strong></div>
  </div>
  <div className="paper-payment">
   <h4>PAYMENT OPTIONS</h4>
   <div className="paper-pay-grid">
    <div className="paper-pay-card">
     <div className="paper-pay-title"><CreditCard size={12}/> UPI PAYMENT</div>
     {(profile.qrImage||upiUrl)?<><div className="paper-qr">{profile.qrImage?<img src={profile.qrImage} alt="Custom QR code" style={{width:98,height:98,objectFit:'contain',borderRadius:8,border:'1px solid #e8ebf2',background:'#fff'}}/>:<QRCodeSVG value={upiUrl} size={98} includeMargin/>}</div><strong>{profile.upiName||profile.businessName}</strong>{profile.upiId&&<p>{profile.upiId}</p>}<small>Scan to pay {fmt(payment.dueNow,invoice.currency)}</small></>:<div className="paper-placeholder">Add your UPI ID in Payment setup.</div>}
    </div>
    <div className="paper-pay-card">
     <div className="paper-pay-title"><Landmark size={12}/> BANK TRANSFER</div>
     {(profile.accountNumber||profile.ifsc||profile.bankName)?<div className="paper-bank">{[['Account name',profile.accountName||profile.businessName],['Bank',profile.bankName],['Account no.',profile.accountNumber],['IFSC',profile.ifsc]].filter(([,value])=>value).map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>:<div className="paper-placeholder">Add bank details in Payment setup.</div>}
    </div>
   </div>
  </div>
  <div className="paper-notes">
   <strong>NOTES / TERMS</strong>
   <p>{invoice.notes?.trim()||'No notes added.'}</p>
  </div>
  <div className="paper-footer">Thank you for your business · Please include invoice number with your payment.</div>
 </article>;
}
function Modal({title,close,children,wide=false}){return <div className="modal-backdrop no-print" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}><div className={`modal ${wide?'modal-wide':''}`}><div className="modal-head"><h2>{title}</h2><button className="icon-button" onClick={close}><X size={18}/></button></div><div className="modal-body">{children}</div></div></div>}
export default App;