import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const sdkRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = resolve(sdkRoot, '../..')
const apiRoot = resolve(repoRoot, 'apps/api')
const buildArguments = ['--filter', '@southneuhof/api', 'routes:build']
const build = spawnSync('pnpm', buildArguments, {
  cwd: repoRoot,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

if (build.error || build.status !== 0) {
  process.stderr.write(`sdk-type-check: command failed: pnpm ${buildArguments.join(' ')}\n`)
  process.exit(build.status ?? 1)
}

try {
  const { verifyRouteImportAgreement } = await import('@southneuhof/sprindle/tooling')
  await verifyRouteImportAgreement({
    producerRoot: apiRoot,
    consumerRoot: sdkRoot,
    consumerConfig: resolve(sdkRoot, 'tsconfig.json'),
  })
} catch (error) {
  process.stderr.write(`sdk-type-check: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
}

const compilerPackage = createRequire(resolve(sdkRoot, 'package.json')).resolve('typescript/package.json')
const compiler = resolve(dirname(compilerPackage), 'bin/tsc')
const check = spawnSync(process.execPath, [compiler, '-p', resolve(sdkRoot, 'tsconfig.json'), '--noEmit', '--singleThreaded'], {
  cwd: sdkRoot,
  stdio: 'inherit',
})

if (check.error) {
  process.stderr.write(`sdk-type-check: TypeScript could not start: ${check.error.message}\n`)
  process.exitCode = 1
} else process.exitCode = check.status ?? 1
