// Local-only: temporary records are removed in finally; existing content is preserved.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { workDefinitions } from '../lib/work-bank.ts';
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5173';
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname));
let checks=0;
async function req(path,{cookie,method='GET',body,status=200}={}) {
  const response=await fetch(base+path,{method,headers:{...(cookie?{cookie}:{}),...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const data=await response.json(); assert.equal(response.status,status,`${method} ${path}: ${JSON.stringify(data)}`); checks++;
  return {data,cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
const teacher=(await req('/api/auth/login',{method:'POST',body:{login:'professor',password:'admin'}})).cookie;
const students=[];const questionIds=[];const workIds=[];
const prefix=`QA-${Date.now()}`;
const sql=value=>`'${String(value).replaceAll("'","''")}'`;
function localSQL(command) {
 execFileSync(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--config','dist/server/wrangler.json','--persist-to','.wrangler/state','--command',command],{stdio:'pipe'});
}
try {
  const init=await Promise.all([req('/api/teacher/questions',{cookie:teacher}),req('/api/teacher/works',{cookie:teacher})]);
  const originals=init[0].data.questions.filter(q=>q.id.startsWith('wa1-'));
  assert.equal(originals.length,10);
  assert.equal(init[1].data.works.find(w=>w.id==='W-A1').questions.length,10);
  for (let i=0;i<3;i++) {
    const item=(await req('/api/students',{cookie:teacher,method:'POST',body:{name:`Gestão QA ${i}`,phone:`qa-mgmt-${Date.now()}-${i}`,courseId:i===2?'excel':'word'}})).data.student;
    students.push(item);
    item.cookie=(await req('/api/auth/login',{method:'POST',body:{login:item.phone,password:item.initialPassword}})).cookie;
  }
  for(const route of ['/api/teacher/questions','/api/teacher/works']) {
    await req(route,{status:401});
    for(const method of ['GET','POST','PATCH'])await req(route,{cookie:students[0].cookie,method,...(method!=='GET'?{body:{}}:{}),status:403});
  }
  const valid={courseId:'word',level:'intermediario',prompt:'Qual recurso organiza etapas em ordem?',options:['Numeração','Cor','Margem','Zoom'],correct:0,explanation:'A numeração apresenta uma sequência.'};
  for(const bad of [{...valid,courseId:'office'},{...valid,level:'extremo'},{...valid,options:['A','B','C']},{...valid,options:['A','B','C','D','E']},{...valid,options:['A','A','C','D']},{...valid,correct:4},{...valid,correct:null},{...valid,correct:'0'},{...valid,prompt:''}])await req('/api/teacher/questions',{cookie:teacher,method:'POST',body:bad,status:400});
  const newQuestions=[];
  for (const courseId of ['word','excel','powerpoint']) {
    const q=(await req('/api/teacher/questions',{cookie:teacher,method:'POST',body:{...valid,courseId},status:201})).data.item;
    newQuestions.push(q);questionIds.push(q.id);
  }
  const [custom,excel]=newQuestions;
  const selected=[custom.id,...originals.slice(0,9).map(q=>q.id)];
  let work=(await req('/api/teacher/works',{cookie:teacher,method:'POST',body:{id:prefix,title:'Trabalho do professor',courseId:'word',level:'dificil',lessonTitle:'Aula QA',questionIds:[]},status:201})).data.item;
  workIds.push(work.id);
  const input={id:work.id,title:work.title,courseId:work.courseId,level:work.level,lessonTitle:work.lessonTitle,questionIds:selected,revision:work.revision};
  await req('/api/teacher/works',{cookie:teacher,method:'POST',body:input,status:409});
  await req('/api/assignments',{cookie:teacher,method:'POST',body:{studentId:students[0].id,workId:work.id},status:400});
  assert.ok(!(await req('/api/assignments',{cookie:teacher})).data.works.some(w=>w.id===work.id));
  for(const ids of [[custom.id,custom.id],[excel.id],[...selected,'missing'],['missing']])await req('/api/teacher/works',{cookie:teacher,method:'PATCH',body:{...input,questionIds:ids},status:400});
  work=(await req('/api/teacher/works',{cookie:teacher,method:'PATCH',body:input})).data.item;
  assert.equal(work.questions.length,10);
  assert.ok((await req('/api/assignments',{cookie:teacher})).data.works.some(w=>w.id===work.id));
  await req('/api/teacher/works',{cookie:teacher,method:'PATCH',body:input,status:409});
  const currentWork=(await req('/api/teacher/works',{cookie:teacher})).data.works.find(w=>w.id===work.id);
  assert.equal(currentWork.questions.length,10,'stale updates do not delete associations');
  const released=(await req('/api/assignments',{cookie:teacher,method:'POST',body:{studentId:students[0].id,workId:work.id}})).data.assignments.find(a=>a.work_id===work.id);
  assert.ok(!('definition_snapshot' in released));
  assert.ok(!('questions' in released.work));
  const originalSnapshot=structuredClone(work.questions);
  const edited=(await req('/api/teacher/questions',{cookie:teacher,method:'PATCH',body:{...custom,prompt:'Pergunta revisada',correct:1}})).data.item;
  await req('/api/teacher/questions',{cookie:teacher,method:'PATCH',body:custom,status:409});
  await req('/api/teacher/questions',{cookie:teacher,method:'PATCH',body:{...edited,courseId:'excel'},status:400});
  const start=(await req('/api/assignments/attempts',{cookie:students[0].cookie,method:'POST',body:{assignmentId:released.id}})).data;
  assert.equal(start.questions.find(q=>q.id===custom.id).prompt,custom.prompt,'release retains original question before first start');
  assert.ok(start.questions.every(q=>!('correct' in q)));
  const answers=Object.fromEntries(originalSnapshot.map(q=>[q.id,q.correct]));
  const result=(await req('/api/assignments/attempts',{cookie:students[0].cookie,method:'PATCH',body:{attemptId:start.id,answers}})).data;
  assert.equal(result.score,10);
  const next=(await req('/api/assignments/attempts',{cookie:students[0].cookie,method:'POST',body:{assignmentId:released.id}})).data;
  assert.equal(next.questions.find(q=>q.id===custom.id).prompt,custom.prompt,'retake retains release snapshot');
  assert.notDeepEqual(next.questions.map(q=>q.id),start.questions.map(q=>q.id));
  const later=(await req('/api/assignments',{cookie:teacher,method:'POST',body:{studentId:students[1].id,workId:work.id}})).data.assignments.find(a=>a.work_id===work.id);
  const laterStart=(await req('/api/assignments/attempts',{cookie:students[1].cookie,method:'POST',body:{assignmentId:later.id}})).data;
  assert.equal(laterStart.questions.find(q=>q.id===custom.id).prompt,'Pergunta revisada','new releases use current bank');
  work=(await req('/api/teacher/works',{cookie:teacher,method:'PATCH',body:{...input,revision:work.revision,title:'Título atualizado',questionIds:[]}})).data.item;
  const report=(await req(`/api/students/performance?studentId=${students[0].id}`,{cookie:teacher})).data;
  assert.equal(report.assignments[0].latest_score,10);
  assert.equal(report.assignments[0].work.title,'Trabalho do professor');
  assert.equal(report.assignments[0].work.total,10,'historical total unaffected by draft edits');
  // A pre-management release has no definition_snapshot and must still work.
  const legacyId=crypto.randomUUID();
  localSQL(`INSERT INTO work_assignments (id,work_id,student_id,released_at) VALUES (${sql(legacyId)},'W-A1',${sql(students[0].id)},${sql(new Date().toISOString())});`);
  const legacy=(await req('/api/assignments/attempts',{cookie:students[0].cookie,method:'POST',body:{assignmentId:legacyId}})).data;
  assert.deepEqual([...legacy.questions.map(q=>q.id)].sort(),[...workDefinitions[0].questions.map(q=>q.id)].sort());
  // Verify a complete non-Word work can also be released and answered.
  const excelIds=[excel.id];
  for(let i=1;i<10;i++) {
    const q=(await req('/api/teacher/questions',{cookie:teacher,method:'POST',body:{...valid,courseId:'excel',prompt:`Excel pergunta ${i}`},status:201})).data.item;
    questionIds.push(q.id);excelIds.push(q.id);
  }
  const excelWork=(await req('/api/teacher/works',{cookie:teacher,method:'POST',body:{id:prefix+'-X',title:'Excel básico',courseId:'excel',level:'facil',questionIds:excelIds},status:201})).data.item;
  workIds.push(excelWork.id);
  const excelRelease=(await req('/api/assignments',{cookie:teacher,method:'POST',body:{studentId:students[2].id,workId:excelWork.id}})).data.assignments[0];
  assert.equal(excelRelease.work.courseTitle,'Excel');
  const excelAttempt=(await req('/api/assignments/attempts',{cookie:students[2].cookie,method:'POST',body:{assignmentId:excelRelease.id}})).data;
  assert.equal(excelAttempt.questions.length,10);
  console.log(`PASS: ${checks} HTTP checks; teacher CRUD, validation, course isolation, conflicts, release snapshots, legacy compatibility and Excel flow.`);
} finally {
  for (const student of students) await req(`/api/students?id=${student.id}`,{cookie:teacher,method:'DELETE'});
  if (workIds.length) localSQL(`DELETE FROM managed_works WHERE id IN (${workIds.map(sql).join(',')});`);
  if (questionIds.length) localSQL(`DELETE FROM question_bank WHERE id IN (${questionIds.map(sql).join(',')});`);
}
