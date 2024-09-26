type ServerlessLogFunction = (
    message: string,
    parameters?: Record<string, unknown>
) => void;

export interface ServerlessLogger {
    error: ServerlessLogFunction;
    warning: ServerlessLogFunction;
    notice: ServerlessLogFunction;
    info: ServerlessLogFunction; // --verbose log
    debug: ServerlessLogFunction; // --debug log
}

interface ServerlessProgress {
    update: (updateMessage: string) => void;
    remove: () => void;
}

export interface ServerlessCLIOutput {
    log: ServerlessLogger;
    writeText: ServerlessLogFunction;
    progress: {
        create: ({ message }: { message: string }) => ServerlessProgress;
    };
}

const emptyLogFunction: ServerlessLogFunction = () => undefined;
export const CreateDefaultLogger = (verbose?: boolean, debug?: boolean) => ({
    error: console.error,
    warning: console.warn,
    notice: console.log,
    info: verbose ? console.log : emptyLogFunction,
    debug: debug ? console.debug : emptyLogFunction,
});

export const CreateDefaultCLIOutput = (
    verbose?: boolean,
    debug?: boolean
): ServerlessCLIOutput => ({
    log: CreateDefaultLogger(verbose, debug),
    writeText: console.log,
    progress: {
        create: ({ message }: { message: string }) => {
            console.log(message);
            return {
                update: (updateMessage: string) => {
                    console.log(updateMessage);
                },
                remove: () => {
                    console.log('Removing progress bar');
                },
            };
        },
    },
});
