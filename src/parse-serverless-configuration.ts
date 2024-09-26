import { SecretLocation, ServerlessSecretsBakerConfig } from './types/config';

export const parseServerlessConfiguration = (
    secretsConfig?: ServerlessSecretsBakerConfig
): SecretLocation[] => {
    if (secretsConfig === undefined) return [];

    if (Array.isArray(secretsConfig)) {
        return secretsConfig.map((item) => {
            if (typeof item === 'string') {
                return {
                    name: item,
                    path: item,
                };
            }

            return item;
        });
    }

    if (typeof secretsConfig === 'object') {
        return Object.entries(secretsConfig).map(([name, path]) => ({
            name,
            path,
        }));
    }

    throw new Error(
        'Secret Baker configuration contained an unexpected value.'
    );
};
