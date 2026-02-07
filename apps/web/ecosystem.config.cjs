module.exports = {
    apps: [
        {
            name: 'web',
            script: './build/index.js',
            cwd: '/home/damoang/angple/apps/web',
            env: {
                NODE_ENV: 'production',
                PORT: 3010,
                PUBLIC_PORT: 3010
            },
            instances: 1,
            exec_mode: 'fork',
            autorestart: true,
            watch: false,
            max_memory_restart: '1G'
        }
    ]
};
