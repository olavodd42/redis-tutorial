import express from 'express'; // Importar express
import fetch from 'node-fetch'; // Importar node-fetch
import redis from 'redis'; // Importar redis

const PORT = process.env.PORT || 5000;
const REDIS_PORT = process.env.REDIS_PORT || 6379;

// Criar cliente Redis
const client = redis.createClient({
    socket: {
        port: REDIS_PORT,
    },
});

// Lidando com erros do Redis
client.on('error', (err) => {
    console.error('Erro no cliente Redis:', err);
});

// Conectar ao Redis
await client.connect(); // Certifique-se de aguardar a conexão

const app = express();

// Função para formatar a resposta
function setResponse(username, repos) {
    return `<h2>${username} possui ${repos} repositórios públicos</h2>`;
}

// Middleware para verificar o cache
async function cache(req, res, next) {
    const { username } = req.params;

    try {
        const data = await client.get(username);

        if (data) {
            console.log('Cache hit');
            res.send(setResponse(username, data));
        } else {
            console.log('Cache miss');
            next();
        }
    } catch (err) {
        console.error('Erro ao acessar o Redis:', err.message);
        res.status(500).send('Erro no servidor');
    }
}

// Buscar dados do GitHub e armazenar no Redis
async function getRepos(req, res) {
    try {
        console.log('Buscando dados no GitHub...');

        const { username } = req.params;

        const response = await fetch(`https://api.github.com/users/${username}`);
        if (!response.ok) {
            throw new Error(`GitHub API respondeu com status: ${response.status}`);
        }
        const data = await response.json();

        const repos = data.public_repos;

        // Armazenar dados no Redis com expiração de 1 hora
        await client.setEx(username, 3600, repos.toString());

        res.send(setResponse(username, repos));
    } catch (err) {
        console.error('Erro ao buscar dados:', err.message);
        res.status(500).send('Algo deu errado: ' + err.message);
    }
}

// Rota principal
app.get('/repos/:username', cache, getRepos);

// Iniciar o servidor
app.listen(PORT, () => {
    console.log(`Aplicação rodando na porta ${PORT}`);
});
