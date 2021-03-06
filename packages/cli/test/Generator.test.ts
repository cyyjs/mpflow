import { Generator } from '../src/Generator'
import { Volume, createFsFromVolume } from 'memfs'
import babel, { PluginObj } from '@babel/core'

describe('Generator', () => {
  test('should extend package', async () => {
    const volume = new Volume()
    volume.fromJSON({
      '/package.json': '{"name": "test"}',
    })
    const fs = createFsFromVolume(volume)
    const generator = new Generator('/', { inputFileSystem: fs as any, outputFileSystem: fs as any })
    generator.extendPackage(
      {
        scripts: {
          test: 'echo "test"',
        },
        dependencies: {
          module: '^1.0.0',
        },
      },
      'test',
    )
    await generator.generate()
    expect(JSON.parse(fs.readFileSync('/package.json', 'utf8') as string)).toEqual({
      name: 'test',
      scripts: {
        test: 'echo "test"',
      },
      dependencies: {
        module: '^1.0.0',
      },
    })
  })

  test('should process file', async () => {
    const volume = new Volume()
    volume.fromJSON({
      '/modify.js': 'before modify',
      '/rename.js': 'before rename',
      '/transform.js': 'module.exports = "before transform";',
    })
    const fs = createFsFromVolume(volume)
    const generator = new Generator('/', { inputFileSystem: fs as any, outputFileSystem: fs as any })

    generator.processFile('test modify', 'modify.js', (fileInfo, api) => {
      api.replace('after modify')
    })
    generator.processFile('test rename', 'rename.js', (fileInfo, api) => {
      api.rename('rename.ts')
    })
    generator.processFile('test transform', 'transform.js', (fileInfo, api) => {
      api.transform(
        ({ types }: typeof babel): PluginObj => ({
          name: 'test transform',
          visitor: {
            StringLiteral(p) {
              p.node.value = 'after transform'
            },
          },
        }),
        {},
      )
    })

    await generator.generate(false)

    expect(volume.toJSON()).toEqual({
      '/modify.js': 'after modify',
      '/rename.ts': 'before rename',
      '/transform.js': 'module.exports = "after transform";',
    })
  })
})
