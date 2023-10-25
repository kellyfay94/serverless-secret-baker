import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import fs from 'fs';
import Serverless from 'serverless';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';

import { SECRETS_FILE, ServerlessSecretBaker } from './index';

const createMockServerless = () =>
    ({
        cli: {
            log: () => undefined,
        },
        service: {
            package: {},
            provider: {},
            custom: {
                secretBaker: {},
            },
        },
    }) as unknown as Serverless;

describe('ServerlessSecretBaker', () => {
    let fsWriteFileStub: sinon.SinonStub;
    let fsExistsSyncStub: sinon.SinonStub;
    let fsUnlinkSyncStub: sinon.SinonStub;
    before(() => {
        chai.use(chaiAsPromised);
        chai.use(sinonChai);

        fsWriteFileStub = sinon.stub(fs, 'writeFile');
        fsExistsSyncStub = sinon.stub(fs, 'existsSync');
        fsUnlinkSyncStub = sinon.stub(fs, 'unlinkSync');
    });

    beforeEach(() => {
        fsWriteFileStub.reset();
        fsExistsSyncStub.reset();
        fsUnlinkSyncStub.reset();
    });

    after(() => {
        fsWriteFileStub.restore();
        fsExistsSyncStub.restore();
        fsUnlinkSyncStub.restore();
    });

    it('should write secrets to the correct file on package', async () => {
        // Arrange
        const serverless = createMockServerless();

        // Act
        console.log(SECRETS_FILE);
        const bakedGoods = new ServerlessSecretBaker(serverless);
        await bakedGoods.packageSecrets();

        // Assert
        expect(fsWriteFileStub).to.have.been.calledWith(
            SECRETS_FILE,
            sinon.match.any
        );
    });

    it('should clean up the correct secrets file if it exists', () => {
        // Arrange
        const serverless = createMockServerless();
        fsExistsSyncStub.returns(false);
        fsExistsSyncStub.withArgs(SECRETS_FILE).returns(true);

        // Act
        const bakedGoods = new ServerlessSecretBaker(serverless);
        bakedGoods.cleanupPackageSecrets();

        // Assert
        expect(fsUnlinkSyncStub).to.have.been.calledWith(SECRETS_FILE);
    });

    it('should not clean up the correct secrets file with CLI option to not cleanup', () => {
        // Arrange
        const serverless = createMockServerless();
        fsExistsSyncStub.returns(false);
        fsExistsSyncStub.withArgs(SECRETS_FILE).returns(true);

        // Act
        const bakedGoods = new ServerlessSecretBaker(serverless, {
            'secret-baker-cleanup': false,
        });

        // Assert
        const cleanupFunction = bakedGoods.hooks['after:invoke:local:invoke'];
        expect(cleanupFunction).to.be.undefined;
    });

    it('should not clean up the secrets file if it does not exist', () => {
        // Arrange
        const serverless = createMockServerless();
        fsExistsSyncStub.returns(false);

        // Act
        const bakedGoods = new ServerlessSecretBaker(serverless);
        bakedGoods.cleanupPackageSecrets();

        // Assert
        expect(fs.unlinkSync).not.to.have.been.calledWith(SECRETS_FILE);
    });

    describe('With no secrets defined in SecretBaker Config', () => {
        let serverless;
        let bakedGoods;

        beforeEach(() => {
            serverless = createMockServerless();
            delete serverless.service.custom.secretBaker;
            bakedGoods = new ServerlessSecretBaker(serverless);
        });

        it('should write an empty json object to the output file.', async () => {
            await bakedGoods.writeSecretToFile();
            const secretsJson = fsWriteFileStub.firstCall.args[1];
            const secrets = JSON.parse(secretsJson);

            expect(secrets).to.be.empty;
        });
    });

    describe('With secrets in unexpected format', () => {
        let serverless;
        let bakedGoods;

        beforeEach(() => {
            serverless = createMockServerless();
            serverless.service.custom.secretBaker = 5;
            bakedGoods = new ServerlessSecretBaker(serverless);
        });

        it('should write an empty json object to the output file.', async () => {
            expect(bakedGoods.writeSecretToFile()).to.be.rejected;
        });
    });

    describe('With Secrets Object', () => {
        const expectedSecretName = 'MY_SECRET';
        const expectedParameterStoreKey = 'PARAMETER STORE KEY';
        const expectedCiphertext = 'SECRET VALUE CIPHERTEXT';
        const expectedArn = 'SECRET VALUE CIPHERTEXT';

        let serverless;
        let bakedGoods;

        beforeEach(() => {
            serverless = createMockServerless();
            serverless.service.custom.secretBaker[expectedSecretName] =
                expectedParameterStoreKey;
            bakedGoods = new ServerlessSecretBaker(serverless);
            sinon.stub(bakedGoods, 'getParameterFromSsm');
            bakedGoods.getParameterFromSsm.resolves({
                Value: expectedCiphertext,
                ARN: expectedArn,
            });
        });

        it('should write ciphertext for secret to secrets file on package', async () => {
            await bakedGoods.writeSecretToFile();
            const secretsJson = fsWriteFileStub.firstCall.args[1];
            const secrets = JSON.parse(secretsJson);

            expect(secrets[expectedSecretName].ciphertext).to.equal(
                expectedCiphertext
            );
        });

        it('should write ARN from secret to secrets file on package', async () => {
            await bakedGoods.writeSecretToFile();
            const secretsJson = fsWriteFileStub.firstCall.args[1];
            const secrets = JSON.parse(secretsJson);

            expect(secrets[expectedSecretName].arn).to.equal(expectedArn);
        });

        it('should throw an error if the parameter cannot be retrieved', async () => {
            bakedGoods.getParameterFromSsm.reset();
            bakedGoods.getParameterFromSsm.resolves(undefined);
            expect(bakedGoods.writeSecretToFile()).to.be.rejected;
        });

        it('should call getParameterFromSsm with the correct parameter key', async () => {
            await bakedGoods.writeSecretToFile();
            expect(bakedGoods.getParameterFromSsm).to.have.been.calledWith(
                expectedParameterStoreKey
            );
        });
    });

    describe('With Secrets String Array', () => {
        const expectedSecretName = 'MY_SECRET';
        const expectedCiphertext = 'SECRET VALUE CIPHERTEXT';
        const expectedArn = 'SECRET VALUE CIPHERTEXT';

        let serverless;
        let bakedGoods;

        beforeEach(() => {
            serverless = createMockServerless();
            serverless.service.custom.secretBaker = [expectedSecretName];
            bakedGoods = new ServerlessSecretBaker(serverless);
            sinon.stub(bakedGoods, 'getParameterFromSsm');
            bakedGoods.getParameterFromSsm.resolves({
                Value: expectedCiphertext,
                ARN: expectedArn,
            });
        });

        it('should write ciphertext for secret to secrets file on package', async () => {
            await bakedGoods.writeSecretToFile();
            const secretsJson = fsWriteFileStub.firstCall.args[1];
            const secrets = JSON.parse(secretsJson);

            expect(secrets[expectedSecretName].ciphertext).to.equal(
                expectedCiphertext
            );
        });

        it('should write ARN from secret to secrets file on package', async () => {
            await bakedGoods.writeSecretToFile();
            const secretsJson = fsWriteFileStub.firstCall.args[1];
            const secrets = JSON.parse(secretsJson);

            expect(secrets[expectedSecretName].arn).to.equal(expectedArn);
        });

        it('should throw an error if the parameter cannot be retrieved', async () => {
            bakedGoods.getParameterFromSsm.reset();
            bakedGoods.getParameterFromSsm.resolves(undefined);
            expect(bakedGoods.writeSecretToFile()).to.be.rejected;
        });

        it('should call getParameterFromSsm with the correct parameter key', async () => {
            await bakedGoods.writeSecretToFile();
            expect(bakedGoods.getParameterFromSsm).to.have.been.calledWith(
                expectedSecretName
            );
        });
    });

    describe('With Secrets Object Array', () => {
        const expectedSecretName = 'MY_SECRET';
        const expectedParameterStoreKey = 'MY_PARAMETER_STORE_KEY';
        const expectedCiphertext = 'SECRET VALUE CIPHERTEXT';
        const expectedArn = 'SECRET VALUE CIPHERTEXT';

        let serverless;
        let bakedGoods;

        beforeEach(() => {
            serverless = createMockServerless();
            serverless.service.custom.secretBaker = [
                {
                    name: expectedSecretName,
                    path: expectedParameterStoreKey,
                },
            ];
            bakedGoods = new ServerlessSecretBaker(serverless);
            sinon.stub(bakedGoods, 'getParameterFromSsm');
            bakedGoods.getParameterFromSsm.resolves({
                Value: expectedCiphertext,
                ARN: expectedArn,
            });
        });

        it('should write ciphertext for secret to secrets file on package', async () => {
            await bakedGoods.writeSecretToFile();
            const secretsJson = fsWriteFileStub.firstCall.args[1];
            const secrets = JSON.parse(secretsJson);

            expect(secrets[expectedSecretName].ciphertext).to.equal(
                expectedCiphertext
            );
        });

        it('should write ARN from secret to secrets file on package', async () => {
            await bakedGoods.writeSecretToFile();
            const secretsJson = fsWriteFileStub.firstCall.args[1];
            const secrets = JSON.parse(secretsJson);

            expect(secrets[expectedSecretName].arn).to.equal(expectedArn);
        });

        it('should throw an error if the parameter cannot be retrieved', async () => {
            bakedGoods.getParameterFromSsm.reset();
            bakedGoods.getParameterFromSsm.resolves(undefined);
            expect(bakedGoods.writeSecretToFile()).to.be.rejected;
        });

        it('should call getParameterFromSsm with the correct parameter key', async () => {
            await bakedGoods.writeSecretToFile();
            expect(bakedGoods.getParameterFromSsm).to.have.been.calledWith(
                expectedParameterStoreKey
            );
        });
    });

    describe('getParameterFromSsm', () => {
        let bakedGoods;
        let requestStub;

        beforeEach(() => {
            const serverless = createMockServerless();
            requestStub = sinon.stub().resolves({});
            bakedGoods = new ServerlessSecretBaker(serverless);
        });

        it('should request SSM getParameter with name', async () => {
            await bakedGoods.getParameterFromSsm('someName');
            expect(requestStub).to.be.calledWith(
                sinon.match.any,
                sinon.match.any,
                sinon.match.has('Name', 'someName'),
                sinon.match.any
            );
        });

        it('should request SSM getParameter with Decrypt false', async () => {
            await bakedGoods.getParameterFromSsm('someName');
            expect(requestStub).to.be.calledWith(
                sinon.match.any,
                sinon.match.any,
                sinon.match.has('WithDecryption', false),
                sinon.match.any
            );
        });

        it('Should resolve to response parameter', async () => {
            requestStub.reset();
            const expectedValue = 'asdfasdfasdf';
            requestStub.resolves({ Parameter: expectedValue });

            const result = await bakedGoods.getParameterFromSsm('someName');

            expect(result).to.equal(expectedValue);
        });

        it('Should Reject to error message if status is not 400', async () => {
            requestStub.reset();
            const expectedMessage = 'Oh NO!!';
            requestStub.rejects({ statusCode: 500, message: expectedMessage });

            await expect(bakedGoods.getParameterFromSsm('someName')).to.be
                .rejected;
        });

        it('Should resolve to undefined if status is 400', async () => {
            requestStub.reset();
            const expectedMessage = 'Oh NO!!';
            requestStub.rejects({ statusCode: 400, message: expectedMessage });

            expect(await bakedGoods.getParameterFromSsm('someName')).to.be
                .undefined;
        });

        // Should Resolve to undefined for other errors
    });
});
