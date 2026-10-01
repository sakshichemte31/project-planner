// Pages = main headings of Proposals_Master_Sheet.xlsx (Sheet1 row 1 + Sheet2 row 1). Fields = every column under them.
const T = (k, label, ph) => ({ k, label, type: 'textarea', ph });
const SCHEMA = [
 { key: 'overview', title: 'Project Overview', sub: 'Core identity of the project.', groups: [
  { fields: [
   { k: 'name', label: 'Project name / Title', type: 'text', req: true, max: 150 },
   { k: 'sector', label: 'Sector', type: 'text', req: true },
   T('why', 'Why'), { ...T('problem', 'Problem statement'), req: true },
   { k: 'sdg', label: 'SDG goal align no.', type: 'text', ph: 'e.g. 3, 4, 10' },
   { k: 'status', label: 'Current status', type: 'select', opts: ['Ideation', 'Pilot', 'Seed', 'Scale'], req: true },
   { k: 'since', label: 'Project active since', type: 'date' },
   { k: 'duration', label: 'Project duration', type: 'text', ph: 'e.g. 3 years' } ] },
  { title: 'Geographics', fields: [ { k: 'geo1', label: 'Stage 1', type: 'text' }, { k: 'geo2', label: 'Stage 2', type: 'text' }, { k: 'geo3', label: 'Stage 3', type: 'text' } ] },
  { title: 'Beneficiary', fields: [
   { k: 'dir', label: 'Direct', type: 'text' }, { k: 'dirN', label: 'Direct – number', type: 'number' },
   { k: 'ind', label: 'Indirect', type: 'text' }, { k: 'indN', label: 'Indirect – number', type: 'number' } ] } ] },
 { key: 'impact', title: 'Expected Impact', sub: 'What changes, for whom, and how you will measure it.', groups: [
  { title: 'Direct beneficiary', fields: [T('dirImp', 'Direct beneficiary impact'), T('dirKpi', "KPI's")] },
  { title: 'Indirect beneficiary', fields: [T('indImp', 'Indirect beneficiary impact'), T('indKpi', "KPI's")] },
  { title: 'Benefit to society', fields: [T('socImp', 'Societal impact'), T('socKpi', "KPI's")] } ] },
 { key: 'beneficiary', title: 'Beneficiary', sub: 'How beneficiaries are chosen and how the project matures.', groups: [
  { title: 'Beneficiary selection', fields: [T('process', 'Process'), T('source', 'Data source'), T('remark', 'Special remark')] },
  { title: 'Stages', fields: [
   T('s0', 'Stage 0', 'Need assessment, project framework planning'), T('s1', 'Stage 1', 'Planning project, proposal present to stakeholders'),
   T('s2', 'Stage 2', 'Project preparedness, team building & beneficiary selection'), T('s3', 'Stage 3', 'Execute project, M&E'),
   T('s4', 'Stage 4', 'Restructure project with customised response for impact efficiency'), T('s5', 'Stage 5', 'Project at scalable stage, replicable model') ] } ] },
 { key: 'hr', title: 'Human Resource', sub: 'Team, stakeholders, partners and volunteers.', groups: [
  { title: 'Team', fields: [T('core', 'Core', 'Director, project core team, area wise core team'), T('adv', 'Advisory', 'Eg. Journalist, educationalist, bureaucrats, field experts'), T('work', 'Working', 'Eg. School teachers, ART staff, Asha workers, auto driver assoc., local grocery store owner, volunteers')] },
  { title: 'Stakeholders', fields: [T('keyS', 'Key stakeholders'), T('othS', 'Other')] },
  { title: 'Working partner', fields: [T('partner', 'Consider Org / NGO / Research body / Govt body')] },
  { title: 'NGOs in same field', fields: [{ k: 'ngos', type: 'table', add: 'Add NGO', cols: [{ k: 'n', label: 'Name' }, { k: 'd', label: 'Details (website) and remark' }] }] },
  { title: 'Volunteer', fields: [{ k: 'vol', type: 'table', add: 'Add category', cols: [{ k: 'c', label: 'Categories (e.g. MBA, MBBS)' }, { k: 'n', label: 'Number', type: 'number', sum: 'Total volunteers' }] }] } ] },
 { key: 'budget', title: 'Budget', sub: 'Salaries (A), operations (B) and assets (C). Totals are calculated for you.', groups: [
  { title: 'Staff – authority positions', fields: [{ k: 'auth', type: 'table', add: 'Add position', cols: [{ k: 'p', label: 'Authority position' }, { k: 'q', label: 'Quantity', type: 'number', sum: 'Staff' }, { k: 'pk', label: 'Package (₹)', type: 'number' }, { k: 't', label: 'Total salary', type: 'calc', mul: ['q', 'pk'], sum: 'Salary' }] }] },
  { title: 'Staff – office positions', fields: [{ k: 'off', type: 'table', add: 'Add position', cols: [{ k: 'p', label: 'Office position' }, { k: 'q', label: 'Quantity', type: 'number', sum: 'Staff' }, { k: 'pk', label: 'Package (₹)', type: 'number' }, { k: 't', label: 'Total salary', type: 'calc', mul: ['q', 'pk'], sum: 'Salary' }] }] },
  { title: 'Staff – field positions', fields: [{ k: 'fld', type: 'table', add: 'Add position', cols: [{ k: 'p', label: 'Field position' }, { k: 'q', label: 'Quantity', type: 'number', sum: 'Staff' }, { k: 'pk', label: 'Package (₹)', type: 'number' }, { k: 't', label: 'Total salary', type: 'calc', mul: ['q', 'pk'], sum: 'Salary' }] }] },
  { title: 'Operations – frequent', fields: [{ k: 'freq', type: 'table', add: 'Add item', cols: [{ k: 'i', label: 'Frequent (e.g. Rent)' }, { k: 'q', label: 'Total no. of frequency in year', type: 'number' }, { k: 'c', label: 'Cost/Qty (₹)', type: 'number' }, { k: 't', label: 'Total', type: 'calc', mul: ['q', 'c'], sum: 'Operations' }] }] },
  { title: 'Operations – infrequent', fields: [{ k: 'infreq', type: 'table', add: 'Add item', cols: [{ k: 'i', label: 'Infrequent (e.g. Wifi recharge)' }, { k: 'q', label: 'Total no. of frequency in year', type: 'number' }, { k: 'c', label: 'Cost/Qty (₹)', type: 'number' }, { k: 't', label: 'Total', type: 'calc', mul: ['q', 'c'], sum: 'Operations' }] }] },
  { title: 'Assets – small', fields: [{ k: 'small', type: 'table', add: 'Add asset', cols: [{ k: 'i', label: 'Small assets (e.g. Table & chair)' }, { k: 'q', label: 'Qty', type: 'number' }, { k: 'c', label: 'Cost/Qty (₹)', type: 'number' }, { k: 't', label: 'Total small assets', type: 'calc', mul: ['q', 'c'], sum: 'Assets' }] }] },
  { title: 'Assets – big', fields: [{ k: 'big', type: 'table', add: 'Add asset', cols: [{ k: 'i', label: 'Big assets (e.g. Printer)' }, { k: 'q', label: 'Qty', type: 'number' }, { k: 'c', label: 'Cost/Qty (₹)', type: 'number' }, { k: 't', label: 'Total big assets', type: 'calc', mul: ['q', 'c'], sum: 'Assets' }] }] },
  { title: 'Budget totals', fields: [{ type: 'budgetSummary' }] } ] },
 { key: 'funding', title: 'Funding', sub: 'Where the money will come from.', groups: [
  { title: 'Assumed annual budget', fields: [{ type: 'budgetTotal', label: 'Salary + Operation + Assets (A+B+C), from the Budget page' }] },
  { title: 'Funding source priority', fields: [T('p1', 'Priority 1'), T('p2', 'Priority 2'), T('p3', 'Priority 3'), T('call', 'Public call of action'), T('donors', 'Potential donors as per revenue stream')] },
  { title: 'Sponsorship aspects', fields: [T('mat', 'Material'), T('evt', 'Event'), T('mkt', 'Marketing')] } ] },
 { key: 'responsibility', title: 'Responsibility', sub: 'Assign priority departments and what each is responsible for.', groups: [
  { title: 'Department prioritisation', fields: [{ k: 'dept', type: 'table', fixed: 7, rowLabel: 'Department', cols: [{ k: 'd', label: 'Department', type: 'select', opts: ['Admin & legal', 'HR', 'Marketing & Networking', 'Finance', 'Fundraising', 'Operations', 'MEL', 'Innovation & Crisis', 'Data & Tech'] }, { k: 'r', label: 'Responsibility / remark' }] }] } ] },
 // Sheet2 main headings – checklists are loaded from checklists.json (generated from the Excel cells)
 { key: 'admin', title: 'Admin & Legal', sub: 'Document checklist.', list: true },
 { key: 'hrprep', title: 'HR', sub: 'Execution preparedness.', list: 'hr' },
 { key: 'marketing', title: 'Marketing & Networking', sub: 'Execution preparedness.', list: true },
 { key: 'finance', title: 'Finance', sub: 'Execution preparedness.', list: true },
 { key: 'fundraising', title: 'Fundraising', sub: 'Execution preparedness.', list: true },
 { key: 'operations', title: 'Operations', sub: 'Execution preparedness.', list: true },
 { key: 'mel', title: 'MEL', sub: 'Execution preparedness.', list: true },
 { key: 'innovation', title: 'Innovation & Crisis', sub: 'Execution preparedness.', list: true },
 { key: 'datatech', title: 'Data & Tech', sub: 'Execution preparedness.', list: true } ];

if (typeof module !== 'undefined') module.exports = SCHEMA;
