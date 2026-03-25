import readline from 'readline'

import { getDb } from '../database.js'

const email = process.argv[2]

if (!email) {
  console.error('Usage: npx tsx src/scripts/promote-admin.ts <email>')
  process.exit(1)
}

const db = getDb()
const user = db.prepare('SELECT id, name, is_admin FROM users WHERE email = ?').get(email) as
  | { id: number; name: string; is_admin: number }
  | undefined

if (!user) {
  console.error(`No user found with email: ${email}`)
  process.exit(1)
}

if (user.is_admin) {
  console.log(`User "${user.name}" (${email}) is already an admin.`)
  process.exit(0)
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
rl.question(`Promote "${user.name}" (${email}) to admin? [y/N] `, (answer) => {
  rl.close()
  if (answer.toLowerCase() !== 'y') {
    console.log('Aborted.')
    process.exit(0)
  }
  db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(user.id)
  console.log(`User "${user.name}" (${email}) has been promoted to admin.`)
})
