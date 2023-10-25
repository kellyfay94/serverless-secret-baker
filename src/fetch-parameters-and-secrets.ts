import { GetParametersCommand, Parameter } from '@aws-sdk/client-ssm';
import { ssmClient } from './clients/ssm-client';
import { SecretLocation } from './types/config';

interface FetchedSecret {
    ciphertext: string;
    arn: string;
}

export const fetchParametersAndSecrets = async (
    secretsConfig: SecretLocation[]
) => {
    // Fetch all of the secrets at once
    const fetchedSecrets = await ssmClient.send(
        new GetParametersCommand({
            Names: secretsConfig.map((item) => item.path),
        })
    );

    // If no parameters were found, throw an error
    if (!fetchedSecrets.Parameters || fetchedSecrets.Parameters.length === 0) {
        throw Error(`No parameters found for any provided paths`);
    }

    // Make a map of all of the fetched secrets paths to their parameters
    const fetchedSecretsMap = new Map<string, Parameter>();
    fetchedSecrets.Parameters.forEach((parameter) => {
        if (!parameter.Name) {
            throw new Error('Parameter name is undefined');
        }
        fetchedSecretsMap.set(parameter.Name, parameter);
    });

    // Map all of the Secret Names to their fetched parameters
    const secrets = new Map<string, FetchedSecret>();
    for (const { name, path } of secretsConfig) {
        const param = fetchedSecretsMap.get(path);

        if (!param) {
            throw Error(`Unable to load Secret ${name}`);
        }

        secrets.set(name, {
            ciphertext: param.Value ?? '',
            arn: param.ARN ?? '',
        });
    }

    return secrets;
};
