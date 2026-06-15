// 1. Inicializa o Supabase com as chaves que você descobriu no painel
const SUPABASE_URL = "https://qcnhmffxzlxpkctnexwg.supabase.co/rest/v1/"; // <-- Cole aqui a URL da foto
const SUPABASE_ANON_KEY = "sb_publishable_9kriS76EBT36WXUuGPrlYA_g96yxXi5"; // <-- Cole aqui a chave 'anon' public da outra foto

// Cria o cliente global do Supabase
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Cria o serviço que o seu script.js tanto precisa para funcionar
window.supabaseService = {
  authReady: Promise.resolve(true),

  // Função que faz o cadastro salvar no Supabase
  signUp: async (usuario) => {
    // 1. Cria na Autenticação
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: usuario.email,
      password: usuario.password,
    });

    if (authError) throw authError;

    // 2. Salva na Tabela de usuários
    const { data: dbData, error: dbError } = await supabase
      .from('usuarios') // Garanta que o nome da sua tabela no Supabase seja 'usuarios'
      .insert([
        {
          id: authData.user.id,
          nome: usuario.nome,
          email: usuario.email,
          cpf: usuario.cpf,
          telefone: usuario.telefone,
          tipo: usuario.tipo,
          cargo: usuario.cargo || "",
          registro_profissional: usuario.registroProfissional || "",
          unidade: usuario.unidade || "",
          foto_perfil: usuario.fotoPerfil || ""
        }
      ])
      .select()
      .single();

    if (dbError) throw dbError;
    return dbData;
  },

  // Função para verificar se o CPF já existe
  getUserDocByCpf: async (cpf) => {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('cpf', cpf)
      .maybeSingle();
    
    if (error) return null;
    return data;
  },

  // Retorna todos os utilizadores (usado no painel do profissional)
  getAllUsers: async () => {
    const { data, error } = await supabase.from('usuarios').select('*');
    if (error) return [];
    return data;
  }
};