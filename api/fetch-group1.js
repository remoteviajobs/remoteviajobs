import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)

export default async function handler(req, res) {
  let allJobs = []
  try {
    const [r1,r2,r3,r4,r5text] = await Promise.all([
      fetch('https://remoteok.com/api',{headers:{'User-Agent':'Mozilla/5.0'}}).then(r=>r.json()),
      fetch('https://remotive.com/api/remote-jobs?limit=50').then(r=>r.json()),
      fetch('https://www.arbeitnow.com/api/job-board-api').then(r=>r.json()),
      fetch('https://jobicy.com/api/v2/remote-jobs?count=50').then(r=>r.json()).catch(()=>({jobs:[]})),
      fetch('https://weworkremotely.com/remote-jobs.rss').then(r=>r.text())
    ])

    allJobs.push(...r1.slice(1,51).map(j=>({title:j.position,company:j.company,url:j.url,source:'RemoteOK',location:'Worldwide'})))
    allJobs.push(...r2.jobs.slice(0,50).map(j=>({title:j.title,company:j.company_name,url:j.url,source:'Remotive',location:'Worldwide'})))
    allJobs.push(...r3.data.slice(0,50).map(j=>({title:j.title,company:j.company_name,url:j.url,source:'Arbeitnow',location:j.location||'Worldwide'})))
    allJobs.push(...(r4.jobs||[]).slice(0,50).map(j=>({title:j.jobTitle,company:j.companyName,url:j.url,source:'Jobicy',location:'Worldwide'})))

    const titles=[...r5text.matchAll(/<title><!\[CDATA\[(.*?)\]\]><\/title>/g)].slice(1,51)
    const links=[...r5text.matchAll(/<link>(.*?)<\/link>/g)].slice(1,51)
    titles.forEach((t,i)=>allJobs.push({title:t[1],company:'WWR',url:links[i]?.[1]||'',source:'WWR',location:'Worldwide'}))

    const oldDate = new Date(); oldDate.setDate(oldDate.getDate()-14);
    await supabase.from('jobs').delete().lt('created_at', oldDate.toISOString())

    const {data:existing} = await supabase.from('jobs').select('url')
    const existingUrls = new Set((existing||[]).map(e=>e.url))
    const newJobs = allJobs.filter(j=>!existingUrls.has(j.url))

    if(newJobs.length>0){
      for(let i=0;i<newJobs.length;i+=100){
        await supabase.from('jobs').insert(newJobs.slice(i,i+100))
      }
    }
    return res.status(200).json({fetched:allJobs.length, new: newJobs.length})
  } catch(e){
    return res.status(500).json({error:e.message})
  }
}
