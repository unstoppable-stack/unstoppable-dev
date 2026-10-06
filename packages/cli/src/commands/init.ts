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
      if (projectName && !isValidProjectName(projectName)) {
        console.error(chalk.red('Project name can only contain lowercase letters, numbers, and hyphens'))
        process.exitCode = 1
        return
      }

      if (options.assistant && !ASSISTANTS.some((assistant) => assistant.id === options.assistant)) {
        console.error(chalk.red(`Unknown assistant "${options.assistant}". Choose: ${ASSISTANTS.map((assistant) => assistant.id).join(', ')}`))
        process.exitCode = 1
        return
      }

      const accent = chalk.hex('#00d4aa')
      const accentBold = chalk.hex('#00d4aa').bold
      const muted = chalk.hex('#71717a')
      const dim = chalk.hex('#a1a1aa')

      console.log()
      console.log(muted('  ─────────────────────────────────────────'))
      console.log()
      console.log(chalk.bold.white('     ⚡ ') + chalk.bold.white('The ') + accentBold('Unstoppable') + chalk.bold.white(' Stack'))
      console.log(dim('     Local data • Local AI • Peer-to-peer'))
      console.log()
      console.log(muted('  ─────────────────────────────────────────'))
      console.log()

      const answers = await promptUser(projectName, options)

      console.log()
      const spinner = ora('Configuring your assistant workspace...').start()

      try {
        const result = await scaffold({
          projectName: answers.projectName,
          template: answers.template,
          assistant: answers.assistant,
          install: options.install !== false,
        })

        if (result.installAttempted && !result.installed) {
          spinner.warn(chalk.yellow('Workspace created, but dependency installation did not complete'))
        } else {
          spinner.succeed(chalk.green('Assistant workspace configured!'))
        }
        console.log()
        printSummary(result)
      } catch (error) {
        spinner.fail(chalk.red('Failed to configure workspace'))
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
        if (!isValidProjectName(input)) {
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

function isValidProjectName(input: string): boolean {
  return /^[a-z0-9-]+$/.test(input)
}

function printSummary(result: any) {
  const accent = chalk.hex('#00d4aa')
  const muted = chalk.hex('#71717a')

  console.log(chalk.bold('  Workspace created at:'), accent(result.projectPath))
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
  if (result.installAttempted && !result.installed) {
    console.log(accent('    npm install'))
  }
  console.log()
  if (result.installAttempted && !result.installed) {
    console.log(chalk.yellow('  Dependency installation failed. Run npm install in this folder and review its output.'))
    console.log()
  }
  console.log(chalk.bold('  Then open this workspace in your AI assistant and ask:'))
  console.log(muted('    Scaffold a Pear Desktop app named coffee-assistant with local AI.'))
  console.log(muted('    Use the Unstoppable Stack CLI, then tell me which folder to run.'))
  console.log()
  console.log(chalk.bold('  Or scaffold it yourself:'))
  console.log(muted('    us scaffold app -p pear-desktop -n coffee-assistant -f local-ai'))
  console.log(muted('    cd coffee-assistant && npm install && npm run dev'))
  console.log()
}
