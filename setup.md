To run, first install the dependencies:

```bash
npm install
```

Then, run the development server with legacy openssl provider:

```bash
$env:NODE_OPTIONS="--openssl-legacy-provider"
npm run serve
```

It won't work with the default openssl provider since the project was created with an older version of node.
