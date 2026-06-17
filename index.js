require('dotenv').config();
const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

function authenticateApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey.trim() !== process.env.BOT_API_KEY?.trim()) {
    return res.status(403).json({ success: false, error: 'API Key inválida' });
  }
  next();
}

app.get('/', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/criar-lead-pipedrive', authenticateApiKey, async (req, res) => {
  const { nome, email, telefone, empresa, evento, origem, portfolio, timeDestino, observacao } = req.body || {};

  if (!nome || !telefone) {
    return res.status(400).json({ success: false, error: 'nome e telefone são obrigatórios' });
  }

  const TOKEN = process.env.PIPEDRIVE_TOKEN;
  const BASE = 'https://api.pipedrive.com/v1';

  try {
    // Passo 1: criar Person
    const personResp = await axios.post(`${BASE}/persons?api_token=${TOKEN}`, {
      name: nome,
      email: [{ value: email || '', primary: true, label: 'work' }],
      phone: [{ value: telefone, primary: true, label: 'mobile' }],
      org_name: empresa || ''
    });

    if (!personResp.data.success) {
      return res.status(500).json({ success: false, error: 'Erro ao criar pessoa no Pipedrive' });
    }

    const personId = personResp.data.data.id;

    // Passo 2: criar Deal
    const dealResp = await axios.post(`${BASE}/deals?api_token=${TOKEN}`, {
      title: `${nome} - ${evento || ''}`,
      person_id: personId,
      pipeline_id: 62,
      stage_id: 583,
      channel: origem || ''
    });

    if (!dealResp.data.success) {
      return res.status(500).json({ success: false, error: 'Erro ao criar deal no Pipedrive' });
    }

    const dealId = dealResp.data.data.id;

    // Passo 3: criar Note
    await axios.post(`${BASE}/notes?api_token=${TOKEN}`, {
      content: `Portfólio: ${portfolio || ''}\nTime destino: ${timeDestino || ''}\nObservação: ${observacao || ''}`,
      deal_id: dealId
    });

    return res.json({ success: true, deal_id: dealId, person_id: personId });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
