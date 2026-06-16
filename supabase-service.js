// Serviço local para desenvolvimento em localhost.
// Mantém a mesma API usada por script.js, mas grava tudo no localStorage.

const localStorageKeys = {
  usuarios: "local_db_usuarios",
  historicos: "local_db_historicos",
  consultas: "local_db_consultas",
  auth: "local_auth_user"
};

function parseLocalData(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}

function saveLocalData(key, data) {
  localStorage.setItem(key, JSON.stringify(data || []));
}

function getLocalUsers() {
  return parseLocalData(localStorageKeys.usuarios);
}

function getLocalHistoricos() {
  return parseLocalData(localStorageKeys.historicos);
}

function getLocalConsultas() {
  return parseLocalData(localStorageKeys.consultas);
}

function saveLocalAuth(authData) {
  localStorage.setItem(localStorageKeys.auth, JSON.stringify(authData || null));
}

function loadLocalAuth() {
  try {
    return JSON.parse(localStorage.getItem(localStorageKeys.auth) || "null");
  } catch {
    return null;
  }
}

function clearLocalAuth() {
  localStorage.removeItem(localStorageKeys.auth);
}

function generateLocalId(prefix = "local") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeUser(user = {}) {
  return {
    ...user,
    uid: user.uid || user.id || generateLocalId("user"),
    fotoPerfil: user.fotoPerfil || user.foto_perfil || "",
    registroProfissional: user.registroProfissional || user.registro_profissional || "",
    informacoesSaude: user.informacoesSaude || user.informacoes_saude || "",
    dataCadastro: user.dataCadastro || user.data_cadastro || ""
  };
}

function toUserRecord(user = {}) {
  return normalizeUser({
    uid: user.uid || generateLocalId("user"),
    nome: user.nome || "",
    email: user.email || "",
    cpf: user.cpf || "",
    telefone: user.telefone || "",
    password: user.password || "",
    tipo: user.tipo || "paciente",
    fotoPerfil: user.fotoPerfil || "",
    dataCadastro: user.dataCadastro || new Date().toISOString(),
    sexo: user.sexo || "",
    estadoCivil: user.estadoCivil || "",
    data: user.data || "",
    estado: user.estado || "",
    cidade: user.cidade || "",
    bairro: user.bairro || "",
    rua: user.rua || "",
    numero: user.numero || "",
    cargo: user.cargo || "",
    registroProfissional: user.registroProfissional || "",
    unidade: user.unidade || "",
    especialidade: user.especialidade || "",
    informacoesSaude: user.informacoesSaude || "",
    exames: user.exames || "",
    enderecoLivre: user.enderecoLivre || ""
  });
}

function upsertLocalUser(user) {
  const normalized = normalizeUser(user);
  const usuarios = getLocalUsers();
  const index = usuarios.findIndex(item =>
    item.uid === normalized.uid ||
    (!!normalized.cpf && item.cpf === normalized.cpf) ||
    (!!normalized.email && item.email === normalized.email)
  );

  if (index >= 0) {
    usuarios[index] = { ...usuarios[index], ...normalized };
  } else {
    usuarios.push(normalized);
  }

  saveLocalData(localStorageKeys.usuarios, usuarios);
  return normalized;
}

function updateLocalCollection(key, id, data) {
  const items = parseLocalData(key);
  const index = items.findIndex(item => item.__docId === id);

  if (index >= 0) {
    items[index] = { ...items[index], ...data, __docId: id };
    saveLocalData(key, items);
    return items[index];
  }

  return null;
}

const supabaseService = {
  user: null,
  profile: null,
  localMode: true,
  authReady: null,

  onAuthStateChanged(callback) {
    callback(this.user);
    return { unsubscribe() {} };
  },

  async signUp(userData) {
    const usuarios = getLocalUsers();

    if (usuarios.some(user => user.email === userData.email)) {
      throw new Error("E-mail já cadastrado.");
    }

    if (usuarios.some(user => user.cpf === userData.cpf)) {
      throw new Error("CPF já cadastrado.");
    }

    const profile = toUserRecord(userData);
    upsertLocalUser(profile);

    this.user = { uid: profile.uid, email: profile.email };
    this.profile = profile;
    saveLocalAuth(this.user);

    return profile;
  },

  async signIn(email, password) {
    const user = getLocalUsers().find(item =>
      item.email === email &&
      item.password === password
    );

    if (!user) {
      throw new Error("E-mail ou senha inválidos.");
    }

    this.user = { uid: user.uid, email: user.email };
    this.profile = normalizeUser(user);
    saveLocalAuth(this.user);

    return { user: this.user, session: null };
  },

  async signOut() {
    clearLocalAuth();
    this.user = null;
    this.profile = null;
  },

  async sendPasswordReset(email) {
    const user = getLocalUsers().find(item => item.email === email);

    if (!user) {
      throw new Error("E-mail não encontrado.");
    }

    return { local: true };
  },

  async getUserDocByUid(uid) {
    if (!uid) return null;
    return getLocalUsers().map(normalizeUser).find(user => user.uid === uid) || null;
  },

  async getUserDocByCpf(cpf) {
    if (!cpf) return null;
    return getLocalUsers().map(normalizeUser).find(user => user.cpf === cpf) || null;
  },

  async updateUserDoc(uid, data) {
    const current = getLocalUsers().find(user => user.uid === uid);
    if (!current) return null;

    const updated = upsertLocalUser({ ...current, ...data, uid });

    if (this.profile?.uid === uid) {
      this.profile = updated;
    }

    return updated;
  },

  async getAllUsers() {
    return getLocalUsers().map(normalizeUser);
  },

  async getHistoricosByUsuarioId(uid) {
    return getLocalHistoricos().filter(item => item.usuarioId === uid);
  },

  async addHistorico(usuarioId, registro) {
    const record = {
      __docId: generateLocalId("hist"),
      usuarioId,
      data: registro.data,
      sistolica: registro.sistolica,
      diastolica: registro.diastolica,
      glicemia: registro.glicemia,
      medicamentos: registro.medicamentos || "",
      sintomas: registro.sintomas || "",
      pressao: registro.pressao || `${registro.sistolica}/${registro.diastolica}`,
      createdAt: new Date().toISOString()
    };

    saveLocalData(localStorageKeys.historicos, [...getLocalHistoricos(), record]);
    return record;
  },

  async updateHistorico(docId, registro) {
    const updateData = {
      data: registro.data,
      sistolica: registro.sistolica,
      diastolica: registro.diastolica,
      glicemia: registro.glicemia,
      medicamentos: registro.medicamentos || "",
      sintomas: registro.sintomas || "",
      pressao: registro.pressao || `${registro.sistolica}/${registro.diastolica}`
    };

    return updateLocalCollection(localStorageKeys.historicos, docId, updateData);
  },

  async deleteHistoricoById(docId) {
    saveLocalData(
      localStorageKeys.historicos,
      getLocalHistoricos().filter(item => item.__docId !== docId)
    );
  },

  async getConsultas() {
    return getLocalConsultas();
  },

  async addConsulta(consulta) {
    const record = {
      __docId: generateLocalId("cons"),
      pacienteId: consulta.pacienteId,
      profissionalId: consulta.profissionalId || "",
      pacienteNome: consulta.pacienteNome,
      profissionalNome: consulta.profissionalNome || "",
      data: consulta.data,
      hora: consulta.hora,
      status: consulta.status || "Pendente",
      createdAt: new Date().toISOString()
    };

    saveLocalData(localStorageKeys.consultas, [...getLocalConsultas(), record]);
    return record;
  },

  async updateConsulta(docId, data) {
    updateLocalCollection(localStorageKeys.consultas, docId, data);
  },

  async deleteUser(uid) {
    saveLocalData(
      localStorageKeys.usuarios,
      getLocalUsers().filter(user => user.uid !== uid)
    );
  },

  async deleteHistoricosByUsuarioId(uid) {
    saveLocalData(
      localStorageKeys.historicos,
      getLocalHistoricos().filter(item => item.usuarioId !== uid)
    );
  },

  async deleteConsultasByUsuarioId(uid) {
    saveLocalData(
      localStorageKeys.consultas,
      getLocalConsultas().filter(item =>
        item.pacienteId !== uid &&
        item.profissionalId !== uid
      )
    );
  },

  async uploadProfilePhoto(uid, file) {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const updated = await this.updateUserDoc(uid, { fotoPerfil: dataUrl });
    return updated?.fotoPerfil || dataUrl;
  }
};

window.supabaseService = supabaseService;

supabaseService.authReady = (async () => {
  const localAuth = loadLocalAuth();

  if (localAuth?.uid) {
    supabaseService.user = localAuth;
    supabaseService.profile = await supabaseService.getUserDocByUid(localAuth.uid);
  }

  return supabaseService.user;
})();
