/* eslint-disable no-unused-expressions */
const { join, parse } = require('node:path');
const { readFile, writeFile } = require('node:fs/promises');
const { promisify } = require('node:util');
const { Readable } = require('node:stream');
const mkdirp = require('mkdirp');
const rmrf = require('rimraf');
const { expect } = require('chai');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { mockClient } = require('aws-sdk-client-mock');

const rimraf = promisify(rmrf);

const {
  init,
  getStorageType,
  saveModule,
  hasModule,
  getModule,
  saveProvider,
  hasProvider,
  getProvider,
} = require('./storage');

const storageTypes = ['file', 's3'];

storageTypes.forEach((storageType) => {
  describe(`${storageType} storage`, async () => {
    let s3Mock;
    beforeEach(async () => {
      if (storageType === 'file') {
        process.env.CITIZEN_STORAGE_PATH = '/tmp/citizen-test';
      } else if (storageType === 's3') {
        s3Mock = mockClient(S3Client);
      }
      await init(storageType);
    });

    afterEach(async () => {
      if (storageType === 'file') {
        await rimraf(process.env.CITIZEN_STORAGE_PATH);
      } else if (storageType === 's3') {
        s3Mock.reset();
      }
    });

    it(`should use ${storageType}`, () => {
      expect(getStorageType()).to.equal(storageType);
    });

    describe('Module', () => {
      const tarballPath = join(__dirname, '..', 'test', 'fixture', 'module.tar.gz');
      let moduleBuf;

      before(async () => {
        moduleBuf = await readFile(tarballPath);
      });

      describe('saveModule()', () => {
        if (storageType === 'file') {
          it('should save the module onto the storage with relative path', async () => {
            process.env.CITIZEN_STORAGE_PATH = './tmp/citizen-test';
            const modulePath = `${new Date().getTime()}/module.tar.gz`;
            const result = await saveModule(modulePath, moduleBuf);
            expect(result).to.be.true;
          });

          it('should save the module onto the storage with absolute path', async () => {
            const modulePath = `${new Date().getTime()}/module.tar.gz`;
            const result = await saveModule(modulePath, moduleBuf);
            expect(result).to.be.true;
          });
        }

        if (storageType === 's3') {
          it('should save the module onto S3', async () => {
            s3Mock.on(PutObjectCommand).resolves({ ETag: '1234' });
            const modulePath = `${new Date().getTime()}/module.tar.gz`;
            const result = await saveModule(modulePath, moduleBuf);
            expect(result).to.be.true;
          });
        }
      });

      describe('hasModule()', () => {
        it('should return true if the module is already exist', async () => {
          const modulePath = `${new Date().getTime()}/module.tar.gz`;
          if (storageType === 'file') {
            const pathToStore = join(process.env.CITIZEN_STORAGE_PATH, 'modules', modulePath);
            const parsedPath = parse(pathToStore);
            await mkdirp(parsedPath.dir);
            await writeFile(pathToStore, moduleBuf);
          } else if (storageType === 's3') {
            s3Mock.on(GetObjectCommand).resolves({ Body: 'data' });
          }

          const exist = await hasModule(modulePath);
          expect(exist).to.be.true;
        });

        it('should return false if the module is not already exist', async () => {
          if (storageType === 's3') {
            s3Mock.on(GetObjectCommand).rejects({ name: 'NoSuchKey' });
          }
          const modulePath = `${new Date().getTime()}/module.tar.gz`;
          const exist = await hasModule(`${modulePath}/wrong`);
          expect(exist).to.be.false;
        });
      });

      describe('getModule()', () => {
        it('should get file buffer from the storage', async () => {
          const modulePath = `${new Date().getTime()}/module.tar.gz`;
          if (storageType === 'file') {
            const pathToStore = join(process.env.CITIZEN_STORAGE_PATH, 'modules', modulePath);
            const parsedPath = parse(pathToStore);
            await mkdirp(parsedPath.dir);
            await writeFile(pathToStore, moduleBuf);
          } else if (storageType === 's3') {
            const buf = Buffer.from('data');
            s3Mock.on(GetObjectCommand).resolves({
              Body: Readable.from(buf),
            });
          }

          const result = await getModule(modulePath);
          expect(result).to.be.an.instanceof(Buffer);
        });
      });
    });

    describe('Provider', () => {
      const tarballPath = join(
        __dirname,
        '..',
        'test',
        'fixture',
        'provider',
        'terraform-provider-null_1.0.0_linux_amd64.zip'
      );
      let providerBuf;

      before(async () => {
        providerBuf = await readFile(tarballPath);
      });

      describe('saveProvider()', () => {
        if (storageType === 'file') {
          it('should save the provider onto the storage with relative path', async () => {
            process.env.CITIZEN_STORAGE_PATH = './tmp/citizen-test';
            const providerPath = `${new Date().getTime()}/provider.tar.gz`;
            const result = await saveProvider(providerPath, providerBuf);
            expect(result).to.be.true;
          });

          it('should save the provider onto the storage with absolute path', async () => {
            const providerPath = `${new Date().getTime()}/provider.tar.gz`;
            const result = await saveProvider(providerPath, providerBuf);
            expect(result).to.be.true;
          });
        }

        if (storageType === 's3') {
          it('should save the provider onto S3', async () => {
            s3Mock.on(PutObjectCommand).resolves({ ETag: '1234' });
            const providerPath = `${new Date().getTime()}/provider.tar.gz`;
            const result = await saveProvider(providerPath, providerBuf);
            expect(result).to.be.true;
          });
        }
      });

      describe('hasProvider()', () => {
        it('should return true if the provider is already exist', async () => {
          const providerPath = `${new Date().getTime()}/provider.tar.gz`;
          if (storageType === 'file') {
            const pathToStore = join(process.env.CITIZEN_STORAGE_PATH, 'providers', providerPath);
            const parsedPath = parse(pathToStore);
            await mkdirp(parsedPath.dir);
            await writeFile(pathToStore, providerBuf);
          } else if (storageType === 's3') {
            s3Mock.on(GetObjectCommand).resolves({ Body: 'data' });
          }

          const exist = await hasProvider(providerPath);
          expect(exist).to.be.true;
        });

        it('should return false if the provider is not already exist', async () => {
          if (storageType === 's3') {
            s3Mock.on(GetObjectCommand).rejects({ name: 'NoSuchKey' });
          }
          const providerPath = `${new Date().getTime()}/provider.tar.gz`;
          const exist = await hasProvider(`${providerPath}/wrong`);
          expect(exist).to.be.false;
        });
      });

      describe('getProvider()', () => {
        it('should get file buffer from the storage', async () => {
          const providerPath = `${new Date().getTime()}/provider.tar.gz`;
          if (storageType === 'file') {
            const pathToStore = join(process.env.CITIZEN_STORAGE_PATH, 'providers', providerPath);
            const parsedPath = parse(pathToStore);
            await mkdirp(parsedPath.dir);
            await writeFile(pathToStore, providerBuf);
          } else if (storageType === 's3') {
            const buf = Buffer.from('data');
            s3Mock.on(GetObjectCommand).resolves({
              Body: Readable.from(buf),
            });
          }

          const result = await getProvider(providerPath);
          expect(result).to.be.an.instanceof(Buffer);
        });
      });
    });
  });
});
