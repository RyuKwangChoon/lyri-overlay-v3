module.exports = {
  apps: [
    {
      name: "overlay-v3-server",
      script: "index.js",
      watch: true,
      env: { NODE_ENV: "development" }
    }
  ]
}
