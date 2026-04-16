#!/usr/bin/env node

import { Command } from 'commander'
import { registerInitCommand } from './commands/init.js'
import { registerScaffoldCommand } from './commands/scaffold.js'
import { registerDoctorCommand } from './commands/doctor.js'
import { registerResearchCommand } from './commands/research.js'
import { registerRemoteCommand } from './commands/remote.js'
import { registerSearchCommand } from './commands/search.js'

const program = new Command()

program
  .name('us')
  .description('The Unstoppable Stack CLI')
  .version('0.2.0')

registerInitCommand(program)
registerScaffoldCommand(program)
registerDoctorCommand(program)
registerResearchCommand(program)
registerRemoteCommand(program)
registerSearchCommand(program)

program.parse()
