export interface SecretLocation {
    name: string;
    path: string;
}

export type ServerlessSecretsBakerConfig =
    | string[]
    | SecretLocation[]
    | Record<string, string>
    | string;
