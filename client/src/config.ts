export const Config: ClientConfig = {
    servers: {
        local: {
            name: "Local",
            address: "localhost:8000",
            https: false
        }
    }
};

interface ClientConfig {
    readonly servers: Record<string, {
        readonly name: string
        readonly address: string
        readonly https: boolean
    }>
}
