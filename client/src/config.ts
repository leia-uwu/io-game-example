export const ClientConfig: ClientConfigType = {
    servers: {
        local: {
            name: "Local",
            address: "localhost:8000",
            https: false
        }
    },
    defaultServer: "local"
};

interface ClientConfigType {
    readonly servers: Record<string, {
        readonly name: string
        readonly address: string
        readonly https: boolean
    }>
    readonly defaultServer: string
}
