module.exports = {
    parser: '@typescript-eslint/parser',
    plugins: ['@typescript-eslint'],
    root: true,
    overrides: [
        {
            files: ['*.ts'],
            extends: [
                'eslint:recommended',
                'plugin:@typescript-eslint/recommended-type-checked',
                'plugin:@typescript-eslint/stylistic-type-checked',
            ],
            parserOptions: {
                project: ['./tsconfig.json'],
            },
        },
    ],
};
