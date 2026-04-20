import { Command } from 'commander'
import inquirer from 'inquirer'
import chalk from 'chalk'
import ora from 'ora'
import { scaffold } from '../scaffold.js'
import { TEMPLATES, ASSISTANTS } from '../constants.js'

export function registerInitCommand(program: Command) {
  program
    .command('init [project-name]')
    .description('Initialize a new Unstoppable Stack project with AI agent configuration')
    .option('-a, --assistant <assistant>', 'AI assistant (claude, cursor, opencode, codex, none)')
    .option('--no-install', 'Skip dependency installation')
    .action(async (projectName, options) => {
      const accent = chalk.hex('#00d4aa')
      const accentBold = chalk.hex('#00d4aa').bold
      const muted = chalk.hex('#71717a')
      const dim = chalk.hex('#a1a1aa')

      console.log()
      console.log(muted('  ─────────────────────────────────────────'))
      console.log()
      console.log(chalk.bold.white('     ⚡ ') + chalk.bold.white('The ') + accentBold('Unstoppable') + chalk.bold.white(' Stack'))
      console.log(dim('     P2P • Local AI • Crypto • No Servers'))
      console.log()
      console.log(muted('  ─────────────────────────────────────────'))
      console.log()

      const answers = await promptUser(projectName, options)

      console.log()
      const spinner = ora('Creating your unstoppable app...').start()

      try {
        const result = await scaffold({
          projectName: answers.projectName,
          template: answers.template,
          assistant: answers.assistant,
          install: options.install !== false,
        })

        spinner.succeed(chalk.green('Project created successfully!'))
        console.log()
        printSummary(result)
      } catch (error) {
        spinner.fail(chalk.red('Failed to create project'))
        console.error(error)
        process.exit(1)
      }
    })
}

async function promptUser(projectName?: string, options?: any) {
  const questions: any[] = []

  if (!projectName) {
    questions.push({
      type: 'input',
      name: 'projectName',
      message: 'What is your project name?',
      default: 'my-unstoppable-app',
      validate: (input: string) => {
        if (!input.trim()) return 'Project name is required'
        if (!/^[a-z0-9-]+$/.test(input)) {
          return 'Project name can only contain lowercase letters, numbers, and hyphens'
        }
        return true
      },
    })
  }

  if (!options?.assistant) {
    questions.push({
      type: 'list',
      name: 'assistant',
      message: 'Select your AI assistant:',
      choices: ASSISTANTS.map((a) => ({
        name: `${a.name}${a.description ? chalk.gray(` - ${a.description}`) : ''}`,
        value: a.id,
      })),
    })
  }

  if (!options?.template && TEMPLATES.length > 1) {
    questions.push({
      type: 'list',
      name: 'template',
      message: 'Select a template:',
      choices: TEMPLATES.map((t) => ({
        name: `${t.name}${chalk.gray(` - ${t.description}`)}`,
        value: t.id,
      })),
    })
  }

  const answers = await inquirer.prompt(questions)
  const defaultTemplate = TEMPLATES.length === 1 ? TEMPLATES[0].id : undefined

  return {
    projectName: projectName || answers.projectName,
    template: options?.template || answers.template || defaultTemplate,
    assistant: options?.assistant || answers.assistant,
  }
}

function printSummary(result: any) {
  const accent = chalk.hex('#00d4aa')
  const muted = chalk.hex('#71717a')

  console.log(chalk.bold('  Project created at:'), accent(result.projectPath))
  console.log()

  if (result.agentFiles.length > 0) {
    console.log(chalk.bold(`  AI Assistant configured (${result.assistant}):`))
    for (const file of result.agentFiles) {
      console.log(accent(`    ✓ ${file}`))
    }
    console.log()
  }

  console.log(chalk.bold('  Next steps:'))
  console.log(accent(`    cd ${result.projectName}`))
  if (!result.installed) {
    console.log(accent('    npm install'))
  }
  console.log(accent('    npm run dev'))
  console.log()
  console.log(muted('  Scaffold an app inside your project:'))
  console.log(muted('    us scaffold app -p expo-mobile -n my-app -f local-ai'))
  console.log()
}
