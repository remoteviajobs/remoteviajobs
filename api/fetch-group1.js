import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)

export default async function handler(req, res) {
  let allJobs = []
  try {
    const [r1, r2, r3, r4] = await Promise.all([
      fetch('https://remotive.com/api/remote-jobs?limit=50').then(r => r.json()).catch(() => ({jobs:[]})),
      fetch('https://remoteok.com/api').then(r => r.json()).catch(() => []),
      fetch('https://arbeitnow.com/api/job-board-api').then(r => r.json()).catch(() => ({data:[]})),
      fetch('https://jobicy.com/api/v2/remote-jobs?count=50').then(r => r.json()).catch(() => ({jobs:[]}))
    ])

    if (r1.jobs) allJobs.push(...r1.jobs.slice(0, 50).map(job => ({ title: job.title, company: job.company_name, apply_url: job.url, source: 'Remotive', location: job.candidate_required_location || 'Remote', description: job.description, salary: job.salary || 'Not specified' })))
    if (Array.isArray(r2)) allJobs.push(...r2.slice(0, 50).map(job => ({ title: job.position, company: job.company, apply_url: job.url, source: 'RemoteOK', location: 'Worldwide', description: job.description, salary: job.salary || 'Not specified' })))
    if (r3.data) allJobs.push(...r3.data.slice(0, 50).map(job => ({ title: job.title, company: job.company_name, apply_url: job.url, source: 'Arbeitnow', location: job.location || 'Worldwide', description: job.description, salary: 'Not specified' })))
    if (r4.jobs) allJobs.push(...r4.jobs.slice(0, 50).map(job => ({ title: job.jobTitle, company: job.companyName, apply_url: job.url, source: 'Jobicy', location: job.jobGeo || 'Remote', description: job.jobDescription, salary: job.annualSalaryMin ? `$${job.annualSalaryMin}` : 'Not specified' })))
    
    // Remove duplicates based on apply_url
    const uniqueJobs = Array.from(new Map(allJobs.map(job => [job.apply_url, job])).values())

    // THE FIX: We insert using 'apply_url' to conflict on.
    const { data, error } = await supabase
      .from('jobs')
      .upsert(uniqueJobs, { onConflict: 'apply_url' })

    if (error) {
      return res.status(400).json({ success: false, error: error.message })
    }

    return res.status(200).json({ fetched: uniqueJobs.length, saved: data ? data.length : 0 })

  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
