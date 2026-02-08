#!/usr/bin/env node

import { Command } from 'commander'
import inquirer from 'inquirer'
import chalk from 'chalk'
import ora from 'ora'
import { scaffold } from './scaffold.js'
import { TEMPLATES, MODULES, ASSISTANTS } from './constants.js'

const program = new Command()

program
  .name('create-unstoppable-app')
  .description('Scaffold apps with the Unstoppable Stack')
  .version('0.1.0')
  .argument('[project-name]', 'Name of the project')
  .option('-t, --template <template>', 'Template to use')
  .option('-a, --assistant <assistant>', 'AI assistant (claude, cursor, opencode, none)')
  .option('-m, --modules <modules>', 'Additional modules (comma-separated)')
  .option('--no-install', 'Skip dependency installation')
  .action(async (projectName, options) => {
    console.log()
    console.log(chalk.bold.cyan('  ╔═══════════════════════════════════════════╗'))
    console.log(chalk.bold.cyan('  ║                                           ║'))
    console.log(chalk.bold.cyan('  ║') + chalk.bold.white('     🚀 Create Unstoppable App             ') + chalk.bold.cyan('║'))
    console.log(chalk.bold.cyan('  ║                                           ║'))
    console.log(chalk.bold.cyan('  ╚═══════════════════════════════════════════╝'))
    console.log()

    const answers = await promptUser(projectName, options)

    console.log()
    const spinner = ora('Creating your unstoppable app...').start()

    try {
      const result = await scaffold({
        projectName: answers.projectName,
        template: answers.template,
        assistant: answers.assistant,
        modules: answers.modules,
        install: options.install !== false
      })

      spinner.succeed(chalk.green('Project created successfully!'))
      console.log()

      // Print summary
      printSummary(result)
    } catch (error) {
      spinner.fail(chalk.red('Failed to create project'))
      console.error(error)
      process.exit(1)
    }
  })

async function promptUser(projectName?: string, options?: any) {
  const questions: any[] = []

  // Project name
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
      }
    })
  }

  // AI Assistant
  if (!options?.assistant) {
    questions.push({
      type: 'list',
      name: 'assistant',
      message: 'Select your AI assistant:',
      choices: ASSISTANTS.map(a => ({
        name: `${a.name}${a.description ? chalk.gray(` - ${a.description}`) : ''}`,
        value: a.id
      }))
    })
  }

  // Template - skip prompt if only one template
  if (!options?.template && TEMPLATES.length > 1) {
    questions.push({
      type: 'list',
      name: 'template',
      message: 'Select a template:',
      choices: TEMPLATES.map(t => ({
        name: `${t.name}${chalk.gray(` - ${t.description}`)}`,
        value: t.id
      }))
    })
  }

  // Additional modules (only ask if not provided via CLI)
  // Note: empty string means "no additional modules", undefined means "ask"
  if (options?.modules === undefined) {
    questions.push({
      type: 'checkbox',
      name: 'modules',
      message: 'Select additional modules:',
      choices: (answers: any) => {
        const template = options?.template || answers.template
        const templateDef = TEMPLATES.find(t => t.id === template)
        const includedModules: readonly string[] = templateDef?.modules || []

        return MODULES.map(m => ({
          name: `${m.name}${chalk.gray(` - ${m.description}`)}`,
          value: m.id,
          checked: includedModules.includes(m.id),
          disabled: includedModules.includes(m.id) ? chalk.gray('(included in template)') : false
        }))
      }
    })
  }

  const answers = await inquirer.prompt(questions)

  // Parse modules from CLI option if provided
  // Empty string means no modules, undefined means use prompt answer
  const cliModules = options?.modules !== undefined
    ? (options.modules ? options.modules.split(',').map((m: string) => m.trim()).filter(Boolean) : [])
    : null

  // Default to first template if only one exists
  const defaultTemplate = TEMPLATES.length === 1 ? TEMPLATES[0].id : undefined

  return {
    projectName: projectName || answers.projectName,
    template: options?.template || answers.template || defaultTemplate,
    assistant: options?.assistant || answers.assistant,
    modules: cliModules || answers.modules || []
  }
}

function printSummary(result: any) {
  console.log(chalk.bold('  Project created at:'), chalk.cyan(result.projectPath))
  console.log()

  if (result.agentFiles.length > 0) {
    console.log(chalk.bold(`  AI Assistant configured (${result.assistant}):`))
    for (const file of result.agentFiles) {
      console.log(chalk.green(`    ✓ ${file}`))
    }
    console.log()
  }

  console.log(chalk.bold('  Next steps:'))
  console.log(chalk.cyan(`    cd ${result.projectName}`))
  if (!result.installed) {
    console.log(chalk.cyan('    pnpm install'))
  }
  console.log(chalk.cyan('    pnpm dev'))
  console.log()
}

program.parse()
