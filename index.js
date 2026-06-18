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

const CHANNEL_MAP = {
  'Events': 698,
  'Events_Referral_Ambassadors': 976,
  'Referral_Ambassadors': 6
};

const EVENTO_MAP = {
  'ABRAINC': 1010
};

app.get('/', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/criar-lead-pipedrive', authenticateApiKey, async (req, res) => {
  const { nome, email, telefone, empresa, evento, origem, timeDestino, observacao } = req.body || {};

  if (!nome || !telefone) {
    return res.status(400).json({ success: false, error: 'nome e telefone são obrigatórios' });
  }

  const TOKEN = process.env.PIPEDRIVE_TOKEN;
  const BASE = 'https://api.pipedrive.com/v1';
  const channelId = CHANNEL_MAP[origem] || null;
  const eventoId = EVENTO_MAP[evento] || null;

  try {
    let orgId = null;
    if (empresa) {
      const orgResp = await axios.post(`${BASE}/organizations?api_token=${TOKEN}`, { name: empresa });
      if (orgResp.data.success) {
        orgId = orgResp.data.data.id;
      } else {
        console.log('Erro ao criar organização:', orgResp.data);
      }
    }

    const personPayload = {
      name: nome,
      email: [{ value: email || '', primary: true, label: 'work' }],
      phone: [{ value: telefone, primary: true, label: 'mobile' }]
    };
    if (orgId) personPayload.org_id = orgId;

    const personResp = await axios.post(`${BASE}/persons?api_token=${TOKEN}`, personPayload);
    if (!personResp.data.success) {
      console.log('Erro ao criar pessoa:', personResp.data);
      return res.status(500).json({ success: false, error: 'Erro ao criar pessoa no Pipedrive', detail: personResp.data });
    }

    const personId = personResp.data.data.id;

    const dealPayload = {
      title: `${empresa || nome}`,
      person_id: personId,
      org_id: orgId || null,
      pipeline_id: 62,
      stage_id: 583,
      'f563ad035a06aaa1ccf4042322d37a62c3a179d3': eventoId
    };
    if (channelId) dealPayload.channel = channelId;

    const dealResp = await axios.post(`${BASE}/deals?api_token=${TOKEN}`, dealPayload);
    if (!dealResp.data.success) {
      console.log('Erro ao criar deal:', dealResp.data);
      return res.status(500).json({ success: false, error: 'Erro ao criar deal no Pipedrive', detail: dealResp.data });
    }

    const dealId = dealResp.data.data.id;

    const noteResp = await axios.post(`${BASE}/notes?api_token=${TOKEN}`, {
      content: `Time destino: ${timeDestino || ''}\nObservação: ${observacao || ''}`,
      deal_id: dealId
    });

    if (!noteResp.data.success) {
      console.log('Erro ao criar nota:', noteResp.data);
    }

    return res.json({ success: true, deal_id: dealId, person_id: personId, org_id: orgId });

  } catch (error) {
    console.log('Erro detalhado:', error.response?.data || error.message);
    return res.status(500).json({ success: false, error: error.message, detail: error.response?.data || null });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
