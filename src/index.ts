import fs from 'fs';
import Serverless from 'serverless';

import { fetchParametersAndSecrets } from './fetch-parameters-and-secrets';
import { parseServerlessConfiguration } from './parse-serverless-configuration';
import { ServerlessSecretsBakerCLIOptions } from './types/cli-options';
import { ServerlessSecretsBakerConfig } from './types/config';
import {
    CreateDefaultCLIOutput,
    ServerlessCLIOutput,
    ServerlessLogger,
} from './types/serverless';

export const SECRETS_FILE = 'secret-baker-secrets.json';

type ServerlessHooks = Record<string, () => Promise<void> | void>;

export class ServerlessSecretBaker {
    serverless: Serverless;
    options: ServerlessSecretsBakerCLIOptions;
    hooks: ServerlessHooks;
    log: ServerlessLogger;

    constructor(
        serverless: Serverless,
        options?: ServerlessSecretsBakerCLIOptions,
        cliOutput?: ServerlessCLIOutput
    ) {
        // Set Default Options and values
        options = options ?? {};
        cliOutput =
            cliOutput ?? CreateDefaultCLIOutput(options.verbose, options.debug);

        // By Default, cleanup secrets file
        const shouldCleanup =
            options['secret-baker-cleanup'] === undefined ||
            options['secret-baker-cleanup'];

        const boundPackageSecrets = this.packageSecrets.bind(this);
        const boundCleanupPackageSecrets =
            this.cleanupPackageSecrets.bind(this);

        this.hooks = {
            'before:package:createDeploymentArtifacts': boundPackageSecrets,
            'before:deploy:function:packageFunction': boundPackageSecrets,
            // For serverless-offline plugin
            'before:offline:start': boundPackageSecrets,
            // For invoke local
            'before:invoke:local:invoke': boundPackageSecrets,
            // Cleanup Hooks
            ...(shouldCleanup && {
                'after:package:createDeploymentArtifacts':
                    boundCleanupPackageSecrets,
                'after:deploy:function:packageFunction':
                    boundCleanupPackageSecrets,
                // For serverless-offline plugin
                'before:offline:start:end': boundCleanupPackageSecrets,
                // For invoke local
                'after:invoke:local:invoke': boundCleanupPackageSecrets,
            }),
        };

        this.options = options;
        this.serverless = serverless;
        this.log = cliOutput.log;
    }

    getSecretsConfig() {
        return parseServerlessConfiguration(
            this.serverless.service.custom?.secretBaker as
                | ServerlessSecretsBakerConfig
                | undefined
        );
    }

    async writeSecretToFile() {
        const providerSecrets = this.getSecretsConfig();

        const secrets = await fetchParametersAndSecrets(providerSecrets);

        fs.writeFileSync(SECRETS_FILE, JSON.stringify(secrets));
    }

    cleanupPackageSecrets() {
        this.log.info(`Cleaning up ${SECRETS_FILE}`);
        if (fs.existsSync(SECRETS_FILE)) fs.unlinkSync(SECRETS_FILE);
    }

    async packageSecrets() {
        this.log.info('Serverless Secrets beginning packaging process');

        const includeArray = (this.serverless.service.package.include ||
            []) as string[];

        await this.writeSecretToFile();
        includeArray.push(SECRETS_FILE);

        this.serverless.service.package.include = includeArray;
    }
}
