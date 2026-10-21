import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useUI, useModalA11y } from '../components/UIProvider';
import { usePolling } from '../hooks/usePolling';

export interface SubtaskItem {
  id?: string;
  text: string;
  done: boolean;
}

export interface TaskItem {
  id: number;
  titulo: string;
  descricao: string;
  status: 'todo' | 'doing' | 'done';
  assigned_username: string;
  deadline: string;
  checklist?: SubtaskItem[] | string[] | any;
  created_at?: string;
  completed_at?: string;
}

export interface MessageItem {
  id: number;
  username: string;
  texto: string;
  arquivo?: string;
  data_envio: string;
}

export function Workspace() {
  const { avisar, confirmar } = useUI();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  
  // Abas de navegação
  const [activeTab, setActiveTab] = useState<'Kanban' | 'Mensagens' | 'Métricas' | 'Participantes'>('Kanban');
  
  // Estado dos dados
  const [projeto, setProjeto] = useState<any>(null);
  const [membros, setMembros] = useState<string[]>([]);
  const [mensagens, setMensagens] = useState<MessageItem[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Gavetas laterais deslizantes (off-canvas slide-over drawers)
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);

  // Filtros do Kanban
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMember, setFilterMember] = useState<string>('all');

  // Drag and drop do Kanban
  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  // Subtarefas expandidas por card (id da tarefa -> boolean)
  const [expandedSubtasks, setExpandedSubtasks] = useState<Record<number, boolean>>({});

  // Chat input
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Modal: Nova Tarefa
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [taskTitulo, setTaskTitulo] = useState('');
  const [taskDescricao, setTaskDescricao] = useState('');
  const [taskAssigned, setTaskAssigned] = useState('');
  const [taskDeadline, setTaskDeadline] = useState('');
  const [newSubtasks, setNewSubtasks] = useState<string[]>([]);
  const [tempSubtaskInput, setTempSubtaskInput] = useState('');
  const [creatingTask, setCreatingTask] = useState(false);

  // Modal: Detalhes / Edição de Tarefa
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const novaTarefaRef = useRef<HTMLDivElement>(null);
  const editTarefaRef = useRef<HTMLDivElement>(null);
  useModalA11y(showNewTaskModal, () => setShowNewTaskModal(false), novaTarefaRef);
  useModalA11y(!!editingTask, () => setEditingTask(null), editTarefaRef);
  const [editTitulo, setEditTitulo] = useState('');
  const [editDescricao, setEditDescricao] = useState('');
  const [editAssigned, setEditAssigned] = useState('');
  const [editDeadline, setEditDeadline] = useState('');
  const [editSubtasks, setEditSubtasks] = useState<SubtaskItem[]>([]);
  const [editNewSubtaskText, setEditNewSubtaskText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Normalização de subtarefas em objetos { text, done }
  const normalizeSubtasks = (checklist: any): SubtaskItem[] => {
    if (!checklist) return [];
    if (typeof checklist === 'string') {
      try {
        checklist = JSON.parse(checklist);
      } catch (e) {
        return [];
      }
    }
    if (!Array.isArray(checklist)) return [];
    return checklist.map((item, idx) => {
      if (typeof item === 'string') {
        return { id: `st-${idx}`, text: item, done: false };
      }
      if (item && typeof item === 'object') {
        return {
          id: item.id || `st-${idx}`,
          text: item.text || item.titulo || '',
          done: Boolean(item.done || item.concluida)
        };
      }
      return { id: `st-${idx}`, text: String(item), done: false };
    });
  };

  // Carregar dados iniciais do workspace
  const carregarWorkspace = async () => {
    try {
      setError('');
      const res = await api.get(`/projeto/${id}/workspace`);
      if (res.data.status === 'success' || res.data.projeto) {
        setProjeto(res.data.projeto);
        setMembros(res.data.membros || []);
        setMensagens(res.data.mensagens || []);
      } else {
        setError(res.data.message || 'Não foi possível carregar os dados do workspace.');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao autenticar acesso ao workspace deste projeto.');
    } finally {
      setLoading(false);
    }
  };

  const carregarTasks = async () => {
    try {
      const res = await api.get(`/projeto/${id}/tasks`);
      if (Array.isArray(res.data)) {
        setTasks(res.data);
      }
    } catch (err) {
      console.error('Erro ao carregar tarefas do Kanban:', err);
    }
  };

  useEffect(() => {
    carregarWorkspace();
    carregarTasks();
  }, [id]);

  // Polling de mensagens no chat
  const totalMensagens = useRef(0);
  usePolling(async () => {
    const res = await api.get(`/projeto/${id}/workspace/mensagens`);
    if (!Array.isArray(res.data)) return false;
    const houveNovidade = res.data.length !== totalMensagens.current;
    totalMensagens.current = res.data.length;
    if (houveNovidade) setMensagens(res.data);
    return houveNovidade;
  }, 4000, 30000, activeTab === 'Mensagens', [id, activeTab]);

  useEffect(() => {
    if (activeTab === 'Mensagens') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [mensagens, activeTab]);

  // Enviar mensagem no chat
  const handleEnviarMensagem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!texto.trim() || enviando) return;

    setEnviando(true);
    try {
      const res = await api.post(`/projeto/${id}/workspace/enviar_ajax`, { texto });
      if (res.data.status === 'success' || res.status === 200) {
        setTexto('');
        const msgRes = await api.get(`/projeto/${id}/workspace/mensagens`);
        if (Array.isArray(msgRes.data)) {
          setMensagens(msgRes.data);
        } else {
          setMensagens(prev => [...prev, {
            id: Date.now(),
            username: user?.username || 'Você',
            texto: texto,
            data_envio: 'Agora'
          }]);
        }
      }
    } catch (err: any) {
      avisar(err.response?.data?.message || 'Erro ao enviar mensagem.');
    } finally {
      setEnviando(false);
    }
  };

  // Mover status da tarefa (drag or click)
  const handleMoverTask = async (taskId: number, novoStatus: 'todo' | 'doing' | 'done') => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: novoStatus } : t));
    try {
      await api.post(`/projeto/${id}/tasks/${taskId}/mover`, { status: novoStatus });
    } catch (err: any) {
      avisar(err.response?.data?.error || 'Erro ao mover tarefa.');
      carregarTasks();
    }
  };

  // Alternar checkbox de subtarefa direto no card
  const handleToggleSubtaskOnCard = async (task: TaskItem, subtaskIndex: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentList = normalizeSubtasks(task.checklist);
    const updated = currentList.map((st, i) => i === subtaskIndex ? { ...st, done: !st.done } : st);

    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, checklist: updated } : t));

    try {
      await api.post(`/projeto/${id}/tasks/${task.id}/editar`, {
        checklist: updated
      });
    } catch (err: any) {
      console.error('Erro ao atualizar subtarefa:', err);
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, checklist: currentList } : t));
    }
  };

  // Excluir tarefa
  const handleExcluirTask = async (taskId: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!await confirmar('Tem certeza que deseja excluir esta tarefa do projeto?')) return;
    try {
      await api.post(`/projeto/${id}/tasks/${taskId}/excluir`);
      setTasks(prev => prev.filter(t => t.id !== taskId));
      if (editingTask?.id === taskId) {
        setEditingTask(null);
      }
    } catch (err: any) {
      avisar(err.response?.data?.error || 'Erro ao excluir tarefa.');
    }
  };

  // Adicionar subtarefa na lista temporária do modal de criação
  const handleAddTempSubtask = (e: React.KeyboardEvent | React.MouseEvent) => {
    if ('key' in e && e.key !== 'Enter') return;
    if ('preventDefault' in e) e.preventDefault();
    if (!tempSubtaskInput.trim()) return;

    setNewSubtasks(prev => [...prev, tempSubtaskInput.trim()]);
    setTempSubtaskInput('');
  };

  const handleRemoveTempSubtask = (index: number) => {
    setNewSubtasks(prev => prev.filter((_, i) => i !== index));
  };

  // Criar nova tarefa
  const handleCriarTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitulo.trim()) return;

    setCreatingTask(true);
    try {
      const checklistPayload = newSubtasks.map(text => ({ text, done: false }));
      const res = await api.post(`/projeto/${id}/tasks/criar`, {
        titulo: taskTitulo,
        descricao: taskDescricao,
        assigned_username: taskAssigned,
        deadline: taskDeadline,
        checklist: checklistPayload
      });
      if (res.data.status === 'success' && res.data.task) {
        setTasks(prev => [...prev, res.data.task]);
        setShowNewTaskModal(false);
        setTaskTitulo('');
        setTaskDescricao('');
        setTaskAssigned('');
        setTaskDeadline('');
        setNewSubtasks([]);
        setTempSubtaskInput('');
      } else {
        avisar(res.data.error || 'Erro ao registrar tarefa.');
      }
    } catch (err: any) {
      avisar(err.response?.data?.error || 'Erro ao criar tarefa.');
    } finally {
      setCreatingTask(false);
    }
  };

  // Abrir modal de edição/detalhes
  const handleOpenEditTask = (task: TaskItem) => {
    setEditingTask(task);
    setEditTitulo(task.titulo);
    setEditDescricao(task.descricao || '');
    setEditAssigned(task.assigned_username || '');
    setEditDeadline(task.deadline || '');
    setEditSubtasks(normalizeSubtasks(task.checklist));
    setEditNewSubtaskText('');
  };

  // Adicionar subtarefa no modal de edição
  const handleAddEditSubtask = (e: React.KeyboardEvent | React.MouseEvent) => {
    if ('key' in e && e.key !== 'Enter') return;
    if ('preventDefault' in e) e.preventDefault();
    if (!editNewSubtaskText.trim()) return;

    setEditSubtasks(prev => [...prev, { text: editNewSubtaskText.trim(), done: false }]);
    setEditNewSubtaskText('');
  };

  const handleToggleEditSubtask = (index: number) => {
    setEditSubtasks(prev => prev.map((st, i) => i === index ? { ...st, done: !st.done } : st));
  };

  const handleRemoveEditSubtask = (index: number) => {
    setEditSubtasks(prev => prev.filter((_, i) => i !== index));
  };

  // Salvar alterações da tarefa
  const handleSalvarEdicaoTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask || !editTitulo.trim()) return;

    setSavingEdit(true);
    try {
      const res = await api.post(`/projeto/${id}/tasks/${editingTask.id}/editar`, {
        titulo: editTitulo,
        descricao: editDescricao,
        assigned_username: editAssigned,
        deadline: editDeadline,
        checklist: editSubtasks
      });
      if (res.data.status === 'success' && res.data.task) {
        setTasks(prev => prev.map(t => t.id === editingTask.id ? res.data.task : t));
        setEditingTask(null);
      } else {
        avisar(res.data.error || 'Erro ao salvar alterações.');
      }
    } catch (err: any) {
      avisar(err.response?.data?.error || 'Erro ao atualizar tarefa.');
    } finally {
      setSavingEdit(false);
    }
  };

  // Alternar visualização de subtarefas em um card
  const toggleSubtasksExpand = (taskId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedSubtasks(prev => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  if (loading) {
    return (
      <div className="flex-1 w-full h-full flex justify-center items-center bg-slate-50">
        <div className="text-center p-6 bg-white rounded-2xl shadow-sm border border-slate-200">
          <div className="animate-spin rounded-full h-10 w-10 border-3 border-[#002B49] border-t-transparent mx-auto mb-3"></div>
          <p className="text-xs font-semibold text-slate-700">Conectando ao Workspace institucional...</p>
        </div>
      </div>
    );
  }

  if (error || !projeto) {
    return (
      <div className="flex-1 w-full h-full flex flex-col justify-center items-center p-6 bg-slate-50 text-center">
        <div className="bg-white p-8 rounded-2xl shadow-sm max-w-md border border-slate-200 space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-[#002B49]">Acesso Restrito ao Projeto</h3>
          <p className="text-slate-600 text-xs leading-relaxed">
            {error || 'Você precisa ser integrante aprovado, orientador ou administrador para visualizar esta área de trabalho.'}
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Link 
              to="/projetos" 
              className="bg-slate-100 text-slate-700 font-bold px-4 py-2 rounded-xl text-xs hover:bg-slate-200 transition-colors"
            >
              Catálogo de Projetos
            </Link>
            <Link 
              to="/perfil" 
              className="bg-[#002B49] text-white font-bold px-5 py-2 rounded-xl text-xs hover:bg-[#003B64] transition-colors shadow-xs"
            >
              Meu Perfil
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isOwnerOrAdmin = (projeto.owner_username === user?.username) || (user?.role === 'admin') || (user?.role === 'lider');

  // Filtragem das tarefas
  const filteredTasks = tasks.filter(task => {
    const matchesSearch = searchQuery.trim() === '' || 
      task.titulo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (task.descricao && task.descricao.toLowerCase().includes(searchQuery.toLowerCase()));
    
    let matchesMember = true;
    if (filterMember === 'mine') {
      matchesMember = task.assigned_username === user?.username;
    } else if (filterMember !== 'all') {
      matchesMember = task.assigned_username === filterMember;
    }

    return matchesSearch && matchesMember;
  });

  const todoTasks = filteredTasks.filter(t => t.status === 'todo');
  const doingTasks = filteredTasks.filter(t => t.status === 'doing');
  const doneTasks = filteredTasks.filter(t => t.status === 'done');
  
  const totalTasks = tasks.length;
  const doneTasksTotal = tasks.filter(t => t.status === 'done').length;
  const percentComplete = totalTasks > 0 ? Math.round((doneTasksTotal / totalTasks) * 100) : 0;

  return (
    <div className="flex-1 w-full h-full min-h-0 min-w-0 flex flex-col bg-slate-50 text-slate-800 overflow-hidden font-sans">
      
      {/* ======================================================== */}
      {/* 1. BARRA SUPERIOR DO WORKSPACE (RESPONSIVA & INSTITUCIONAL) */}
      {/* ======================================================== */}
      <header className="bg-white border-b border-slate-200 px-3 sm:px-5 py-2.5 shrink-0 z-20 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          
          {/* Esquerda: Botão Sair + Título do Projeto */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link 
              to={`/projeto/${id}`} 
              title="Voltar aos Detalhes do Projeto"
              className="flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-[#002B49] bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg transition-colors shrink-0"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="hidden sm:inline">Sair</span>
            </Link>

            <div className="h-5 w-px bg-slate-200 hidden sm:block shrink-0"></div>

            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-xs sm:text-sm font-bold text-[#002B49] truncate max-w-[150px] sm:max-w-[240px] md:max-w-[340px] lg:max-w-[420px] m-0" title={projeto.titulo}>
                {projeto.titulo}
              </h1>
              <span className="hidden md:inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 uppercase tracking-wide shrink-0">
                {projeto.categoria}
              </span>
            </div>
          </div>

          {/* Centro: Alternador de Abas */}
          <nav className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 shrink-0">
            <button
              onClick={() => setActiveTab('Kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'Kanban' 
                  ? 'bg-[#002B49] text-white shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900 bg-transparent'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
              <span>Kanban</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${activeTab === 'Kanban' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
                {tasks.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('Mensagens')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'Mensagens' 
                  ? 'bg-[#002B49] text-white shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900 bg-transparent'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span className="hidden sm:inline">Mensagens</span>
              {mensagens.length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${activeTab === 'Mensagens' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
                  {mensagens.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('Métricas')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'Métricas' 
                  ? 'bg-[#002B49] text-white shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900 bg-transparent'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="hidden md:inline">Métricas</span>
              <span className={`text-[10px] font-bold ${activeTab === 'Métricas' ? 'text-white' : 'text-emerald-700'}`}>
                {percentComplete}%
              </span>
            </button>

            <button
              onClick={() => setActiveTab('Participantes')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'Participantes' 
                  ? 'bg-[#002B49] text-white shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900 bg-transparent'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span className="hidden lg:inline">Equipe</span>
            </button>
          </nav>

          {/* Direita: Ações Rápidas (Nova Tarefa + Painéis Laterais) */}
          <div className="flex items-center gap-2 shrink-0">
            <button 
              onClick={() => setShowNewTaskModal(true)}
              className="flex items-center gap-1.5 bg-[#002B49] text-white hover:bg-[#003B64] px-3 py-1.5 rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
              title="Criar nova tarefa no Kanban"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M12 4v16m8-8H4" />
              </svg>
              <span>Nova Tarefa</span>
            </button>

            <button 
              onClick={() => setLeftOpen(true)}
              title="Abrir painel da Equipe"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold cursor-pointer transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <span className="hidden sm:inline">Equipe ({membros.length + 1})</span>
            </button>

            <button 
              onClick={() => setRightOpen(true)}
              title="Abrir resumo da pesquisa"
              className="p-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          </div>

        </div>
      </header>

      {/* ======================================================== */}
      {/* 2. ÁREA DE CONTEÚDO PRINCIPAL (100% DA LARGURA) */}
      {/* ======================================================== */}
      <div className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden relative">

        {/* ==================== ABA: KANBAN COM SUBTAREFAS ==================== */}
        {activeTab === 'Kanban' && (
          <div className="flex-1 min-h-0 min-w-0 flex flex-col p-3 sm:p-4 overflow-hidden">
            
            {/* Toolbar do Kanban: Busca e Filtro de Responsável */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3 shrink-0 bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200/80 shadow-2xs">
              
              {/* Campo de Busca de Tarefas */}
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input 
                  type="text"
                  placeholder="Buscar por título ou descrição..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-800 outline-none focus:border-[#002B49] focus:bg-white transition-all"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Filtro por Responsável */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-500 hidden sm:inline">Filtrar:</span>
                <select 
                  value={filterMember}
                  onChange={(e) => setFilterMember(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-[#002B49] cursor-pointer"
                >
                  <option value="all">Todos os Responsáveis</option>
                  {user?.username && <option value="mine">Minhas Tarefas ({user.username})</option>}
                  <option value={projeto.owner_username}>{projeto.owner_username} (Líder)</option>
                  {membros.map((m, i) => (
                    <option key={i} value={m}>{m}</option>
                  ))}
                </select>

                {filterMember !== 'all' && (
                  <button 
                    onClick={() => setFilterMember('all')}
                    className="text-xs text-blue-700 font-bold hover:underline bg-blue-50 px-2 py-1 rounded-lg"
                  >
                    Limpar
                  </button>
                )}
              </div>
            </div>

            {/* COLUNAS KANBAN COM LARGURA FIXA E SCROLL HORIZONTAL FLUIDO */}
            <div className="flex-1 min-h-0 min-w-0 flex gap-4 sm:gap-5 overflow-x-auto overflow-y-hidden pb-2 items-start">
              
              {/* ----------------- COLUNA: A FAZER ----------------- */}
              <div 
                onDragOver={(e) => { e.preventDefault(); setDragOverColumn('todo'); }}
                onDragLeave={() => setDragOverColumn(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverColumn(null);
                  if (draggedTaskId) handleMoverTask(draggedTaskId, 'todo');
                }}
                className={`
                  w-[300px] sm:w-[340px] md:w-[360px] shrink-0 h-full max-h-full
                  bg-slate-100/90 rounded-2xl border flex flex-col shadow-2xs transition-colors overflow-hidden
                  ${dragOverColumn === 'todo' ? 'border-amber-400 bg-amber-50/40' : 'border-slate-200/90'}
                `}
              >
                {/* Header da Coluna */}
                <div className="p-3 border-b border-slate-200/80 flex items-center justify-between shrink-0 bg-white/40">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">A Fazer</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="bg-white border border-slate-200 text-slate-700 text-[11px] font-bold px-2 py-0.5 rounded-full shadow-2xs">
                      {todoTasks.length}
                    </span>
                    <button 
                      onClick={() => setShowNewTaskModal(true)}
                      title="Adicionar tarefa nesta coluna"
                      className="w-6 h-6 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 flex items-center justify-center text-slate-600 hover:text-slate-900 transition-colors font-bold cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Lista de Cards com Rolagem Vertical Independente */}
                <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-2.5">
                  {todoTasks.length === 0 ? (
                    <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-xl my-4">
                      <p className="text-xs text-slate-500 m-0">Nenhuma tarefa pendente nesta etapa.</p>
                    </div>
                  ) : (
                    todoTasks.map(task => renderTaskCard(task, 'todo'))
                  )}
                </div>
              </div>

              {/* ----------------- COLUNA: EM ANDAMENTO ----------------- */}
              <div 
                onDragOver={(e) => { e.preventDefault(); setDragOverColumn('doing'); }}
                onDragLeave={() => setDragOverColumn(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverColumn(null);
                  if (draggedTaskId) handleMoverTask(draggedTaskId, 'doing');
                }}
                className={`
                  w-[300px] sm:w-[340px] md:w-[360px] shrink-0 h-full max-h-full
                  bg-slate-100/90 rounded-2xl border flex flex-col shadow-2xs transition-colors overflow-hidden
                  ${dragOverColumn === 'doing' ? 'border-blue-400 bg-blue-50/40' : 'border-slate-200/90'}
                `}
              >
                <div className="p-3 border-b border-slate-200/80 flex items-center justify-between shrink-0 bg-white/40">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse"></div>
                    <span className="text-xs font-bold text-[#002B49] uppercase tracking-wider">Em Andamento</span>
                  </div>
                  <span className="bg-white border border-slate-200 text-slate-700 text-[11px] font-bold px-2 py-0.5 rounded-full shadow-2xs">
                    {doingTasks.length}
                  </span>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-2.5">
                  {doingTasks.length === 0 ? (
                    <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-xl my-4">
                      <p className="text-xs text-slate-500 m-0">Nenhuma atividade em andamento no momento.</p>
                    </div>
                  ) : (
                    doingTasks.map(task => renderTaskCard(task, 'doing'))
                  )}
                </div>
              </div>

              {/* ----------------- COLUNA: CONCLUÍDO ----------------- */}
              <div 
                onDragOver={(e) => { e.preventDefault(); setDragOverColumn('done'); }}
                onDragLeave={() => setDragOverColumn(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverColumn(null);
                  if (draggedTaskId) handleMoverTask(draggedTaskId, 'done');
                }}
                className={`
                  w-[300px] sm:w-[340px] md:w-[360px] shrink-0 h-full max-h-full
                  bg-slate-100/90 rounded-2xl border flex flex-col shadow-2xs transition-colors overflow-hidden
                  ${dragOverColumn === 'done' ? 'border-emerald-400 bg-emerald-50/40' : 'border-slate-200/90'}
                `}
              >
                <div className="p-3 border-b border-slate-200/80 flex items-center justify-between shrink-0 bg-white/40">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-600"></div>
                    <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Concluído</span>
                  </div>
                  <span className="bg-white border border-slate-200 text-slate-700 text-[11px] font-bold px-2 py-0.5 rounded-full shadow-2xs">
                    {doneTasks.length}
                  </span>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-2.5">
                  {doneTasks.length === 0 ? (
                    <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-xl my-4">
                      <p className="text-xs text-slate-500 m-0">Nenhuma tarefa finalizada até o momento.</p>
                    </div>
                  ) : (
                    doneTasks.map(task => renderTaskCard(task, 'done'))
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ==================== ABA: MENSAGENS / CHAT ==================== */}
        {activeTab === 'Mensagens' && (
          <div className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden bg-slate-50">
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
              {mensagens.length === 0 ? (
                <div className="flex flex-col items-center justify-center my-auto py-16 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#002B49] flex items-center justify-center mb-3">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-bold text-[#002B49]">Canal de Alinhamento Acadêmico</h3>
                  <p className="text-xs text-slate-600 max-w-sm mt-1">Converse em tempo real com orientadores e pesquisadores do projeto.</p>
                </div>
              ) : (
                mensagens.map((msg, idx) => {
                  const isMe = msg.username === user?.username;
                  return (
                    <div key={msg.id || idx} className={`flex gap-2.5 max-w-[85%] sm:max-w-[70%] ${isMe ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}>
                      {!isMe && (
                        <div className="w-7 h-7 rounded-lg bg-[#002B49] text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-1">
                          {msg.username.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        <div className="flex items-center gap-1.5 mb-1 px-1">
                          <span className="text-[11px] font-bold text-slate-700">{msg.username}</span>
                          <span className="text-[10px] text-slate-500">{msg.data_envio}</span>
                        </div>
                        <div className={`p-3 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-xs ${
                          isMe 
                            ? 'bg-[#002B49] text-white rounded-tr-xs' 
                            : 'bg-white border border-slate-200 text-slate-800 rounded-tl-xs'
                        }`}>
                          <p className="m-0 whitespace-pre-wrap">{msg.texto}</p>
                          {msg.arquivo && (
                            <a 
                              href={msg.arquivo} 
                              target="_blank" 
                              rel="noreferrer" 
                              className={`inline-flex items-center gap-1 mt-2 text-xs font-bold underline ${isMe ? 'text-white' : 'text-blue-600'}`}
                            >
                              Ver Anexo
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Input do Chat */}
            <form onSubmit={handleEnviarMensagem} className="p-3 sm:p-4 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0">
              <input 
                type="text"
                placeholder="Escreva uma mensagem para a equipe do projeto..."
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs sm:text-sm outline-none focus:border-[#002B49] focus:bg-white transition-all text-slate-800"
              />
              <button 
                type="submit"
                disabled={enviando || !texto.trim()}
                className="bg-[#002B49] text-white hover:bg-[#003B64] disabled:opacity-40 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer shrink-0"
              >
                {enviando ? 'Enviando...' : 'Enviar'}
              </button>
            </form>
          </div>
        )}

        {/* ==================== ABA: MÉTRICAS ==================== */}
        {activeTab === 'Métricas' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            <div>
              <h2 className="text-base font-bold text-[#002B49] m-0">Indicadores Operacionais do Projeto</h2>
              <p className="text-xs text-slate-600 m-0 mt-0.5">Acompanhamento do progresso geral e velocidade de entrega das atividades.</p>
            </div>

            {/* Cards de Métricas */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Total de Atividades</span>
                <span className="text-2xl font-bold text-[#002B49]">{totalTasks}</span>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Concluídas</span>
                <span className="text-2xl font-bold text-emerald-600">{doneTasksTotal}</span>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Em Andamento</span>
                <span className="text-2xl font-bold text-blue-600">{tasks.filter(t => t.status === 'doing').length}</span>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Taxa de Sucesso</span>
                <span className="text-2xl font-bold text-[#002B49]">{percentComplete}%</span>
              </div>
            </div>

            {/* Barra de Progresso Institucional */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                <span>Evolução Geral das Entregas</span>
                <span className="text-[#002B49]">{percentComplete}% Concluído</span>
              </div>
              <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden border border-slate-200">
                <div 
                  className="bg-emerald-600 h-full transition-all duration-500 rounded-full"
                  style={{ width: `${percentComplete}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-slate-600">
                <span>Início do Ciclo</span>
                <span>{doneTasksTotal} de {totalTasks} tarefas concluídas</span>
                <span>Meta Final</span>
              </div>
            </div>
          </div>
        )}

        {/* ==================== ABA: PARTICIPANTES ==================== */}
        {activeTab === 'Participantes' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            <div>
              <h2 className="text-base font-bold text-[#002B49] m-0">Quadro de Membros e Responsáveis</h2>
              <p className="text-xs text-slate-600 m-0 mt-0.5">Integrantes e orientadores alocados na execução desta pesquisa acadêmica.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Líder */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#002B49] text-white flex items-center justify-center font-bold text-sm shrink-0">
                  {(projeto.owner_username || 'L').substring(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-slate-800 m-0 truncate">{projeto.owner_username}</h4>
                  <span className="text-[10px] text-blue-700 font-bold block mt-0.5">Líder do Projeto</span>
                </div>
              </div>

              {/* Orientador */}
              {projeto.orientador && (
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                    {projeto.orientador.username.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-slate-800 m-0 truncate">{projeto.orientador.username}</h4>
                    <span className="text-[10px] text-blue-600 font-bold block mt-0.5">Professor Orientador</span>
                  </div>
                </div>
              )}

              {/* Alunos */}
              {membros.map((m, i) => (
                <div key={i} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                    {m.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-slate-800 m-0 truncate">{m}</h4>
                    <span className="text-[10px] text-slate-600 font-semibold block mt-0.5">Aluno Pesquisador</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* ======================================================== */}
      {/* 3. GAVETA FLUTUANTE LATERAL ESQUERDA: EQUIPE (SLIDE-OVER) */}
      {/* ======================================================== */}
      <div className={`fixed inset-0 z-50 transition-all duration-300 ${leftOpen ? 'visible pointer-events-auto' : 'invisible pointer-events-none'}`}>
        {/* Backdrop suave */}
        <div 
          onClick={() => setLeftOpen(false)}
          className={`absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300 ${leftOpen ? 'opacity-100' : 'opacity-0'}`}
        />
        
        {/* Painel lateral */}
        <aside className={`absolute inset-y-0 left-0 w-80 max-w-[85vw] bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-out ${leftOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Equipe do Projeto</span>
              <h3 className="text-xs font-bold text-[#002B49] m-0">Integrantes & Orientação</h3>
            </div>
            <button 
              aria-label="Fechar" onClick={() => setLeftOpen(false)}
              className="text-slate-500 hover:text-slate-800 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="p-3 m-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#002B49] text-white flex items-center justify-center text-xs font-bold shrink-0">
              {(user?.username || 'U').substring(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-xs font-bold text-slate-800 truncate block">{user?.username}</span>
              <span className="text-[10px] text-slate-500 uppercase font-semibold">{user?.role || 'Membro'}</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            <div className="flex items-center justify-between px-2 mb-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Filtrar tarefas no Kanban</span>
              {filterMember !== 'all' && (
                <button 
                  onClick={() => { setFilterMember('all'); setLeftOpen(false); }}
                  className="text-[10px] text-blue-700 font-bold hover:underline"
                >
                  Ver Todos
                </button>
              )}
            </div>

            {/* Dono / Líder */}
            <button
              onClick={() => { setFilterMember(filterMember === projeto.owner_username ? 'all' : projeto.owner_username); setLeftOpen(false); }}
              className={`w-full text-left p-2.5 rounded-xl border flex items-center gap-2.5 transition-colors cursor-pointer ${
                filterMember === projeto.owner_username 
                  ? 'bg-blue-50/80 border-blue-300 shadow-xs' 
                  : 'bg-white border-slate-100 hover:bg-slate-50'
              }`}
            >
              <div className="w-7 h-7 rounded-lg bg-[#002B49] text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                {(projeto.owner_username || 'L').substring(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-xs font-semibold text-slate-800 truncate block">{projeto.owner_username}</span>
                <span className="text-[10px] text-blue-700 font-bold">Líder do Projeto</span>
              </div>
              <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full font-bold">
                {tasks.filter(t => t.assigned_username === projeto.owner_username).length}
              </span>
            </button>

            {/* Orientador */}
            {projeto.orientador && (
              <button
                onClick={() => { setFilterMember(filterMember === projeto.orientador.username ? 'all' : projeto.orientador.username); setLeftOpen(false); }}
                className={`w-full text-left p-2.5 rounded-xl border flex items-center gap-2.5 transition-colors cursor-pointer ${
                  filterMember === projeto.orientador.username 
                    ? 'bg-blue-50/80 border-blue-300 shadow-xs' 
                    : 'bg-white border-slate-100 hover:bg-slate-50'
                }`}
              >
                <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                  {projeto.orientador.username.substring(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-semibold text-slate-800 truncate block">{projeto.orientador.username}</span>
                  <span className="text-[10px] text-blue-600 font-bold">Professor Orientador</span>
                </div>
              </button>
            )}

            {/* Membros Alunos */}
            {membros.map((m, idx) => (
              <button
                key={idx}
                onClick={() => { setFilterMember(filterMember === m ? 'all' : m); setLeftOpen(false); }}
                className={`w-full text-left p-2.5 rounded-xl border flex items-center gap-2.5 transition-colors cursor-pointer ${
                  filterMember === m 
                    ? 'bg-blue-50/80 border-blue-300 shadow-xs' 
                    : 'bg-white border-slate-100 hover:bg-slate-50'
                }`}
              >
                <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                  {m.substring(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-semibold text-slate-800 truncate block">{m}</span>
                  <span className="text-[10px] text-slate-500">Pesquisador</span>
                </div>
                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full font-bold">
                  {tasks.filter(t => t.assigned_username === m).length}
                </span>
              </button>
            ))}
          </div>
        </aside>
      </div>

      {/* ======================================================== */}
      {/* 4. GAVETA FLUTUANTE LATERAL DIREITA: RESUMO (SLIDE-OVER) */}
      {/* ======================================================== */}
      <div className={`fixed inset-0 z-50 transition-all duration-300 ${rightOpen ? 'visible pointer-events-auto' : 'invisible pointer-events-none'}`}>
        <div 
          onClick={() => setRightOpen(false)}
          className={`absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300 ${rightOpen ? 'opacity-100' : 'opacity-0'}`}
        />
        
        <aside className={`absolute inset-y-0 right-0 w-80 max-w-[85vw] bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-out ${rightOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <h3 className="text-xs font-bold text-[#002B49] uppercase tracking-wider m-0">Resumo da Pesquisa</h3>
            <button 
              aria-label="Fechar" onClick={() => setRightOpen(false)}
              className="text-slate-500 hover:text-slate-800 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="p-4 space-y-4 overflow-y-auto flex-1">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Título</span>
              <p className="text-xs font-bold text-slate-800 m-0">{projeto.titulo}</p>
            </div>

            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Situação</span>
              <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                {projeto.status}
              </span>
              {projeto.status === 'CONCLUÍDO' && user?.role !== 'coordenador' && (
                <a
                  href={`/api/projeto/${id}/certificado`}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold bg-[#7A1BB5] text-white no-underline"
                >
                  Baixar certificado (PDF)
                </a>
              )}
            </div>

            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Descrição Curta</span>
              <p className="text-xs text-slate-600 leading-relaxed m-0">{projeto.descricao_curta}</p>
            </div>

            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Tags</span>
              <p className="text-xs text-slate-700 m-0">{projeto.tags || 'Geral'}</p>
            </div>
          </div>
        </aside>
      </div>

      {/* ======================================================== */}
      {/* 5. MODAL: NOVA TAREFA (COM ADIÇÃO DE SUBTAREFAS) */}
      {/* ======================================================== */}
      {showNewTaskModal && (
        <div ref={novaTarefaRef} role="dialog" aria-modal="true" aria-label="Nova tarefa" className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-xl border border-slate-200 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100 shrink-0">
              <h3 className="text-sm font-bold text-[#002B49] m-0">Cadastrar Nova Tarefa & Subtarefas</h3>
              <button 
                aria-label="Fechar" onClick={() => setShowNewTaskModal(false)}
                className="text-slate-500 hover:text-slate-800 text-sm p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCriarTask} className="space-y-4 overflow-y-auto flex-1 pr-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Título da Atividade *</label>
                <input 
                  type="text" 
                  required
                  placeholder="Ex: Desenvolver componente do Workspace"
                  value={taskTitulo}
                  onChange={(e) => setTaskTitulo(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#002B49] focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Critérios e Descrição</label>
                <textarea 
                  rows={2}
                  placeholder="Instruções de desenvolvimento para os pesquisadores..."
                  value={taskDescricao}
                  onChange={(e) => setTaskDescricao(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#002B49] focus:bg-white transition-all resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Responsável</label>
                  <select 
                    value={taskAssigned}
                    onChange={(e) => setTaskAssigned(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-800 outline-none focus:border-[#002B49]"
                  >
                    <option value="">Equipe Geral</option>
                    <option value={projeto.owner_username}>{projeto.owner_username} (Líder)</option>
                    {membros.map((m, i) => (
                      <option key={i} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Prazo Limite</label>
                  <input 
                    type="date"
                    value={taskDeadline}
                    onChange={(e) => setTaskDeadline(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-800 outline-none focus:border-[#002B49]"
                  />
                </div>
              </div>

              {/* SEÇÃO DE SUBTAREFAS / CHECKLIST */}
              <div className="pt-2 border-t border-slate-100">
                <label className="block text-xs font-bold text-[#002B49] mb-1">
                  Subtarefas (Checklist)
                </label>
                <p className="text-[11px] text-slate-500 m-0 mb-2">
                  Divida a entrega em passos práticos. Digite o item e pressione Enter ou clique em Adicionar.
                </p>

                <div className="flex gap-2 mb-2.5">
                  <input 
                    type="text"
                    placeholder="Adicionar subtarefa (ex: Criar testes unitários)..."
                    value={tempSubtaskInput}
                    onChange={(e) => setTempSubtaskInput(e.target.value)}
                    onKeyDown={handleAddTempSubtask}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-[#002B49] focus:bg-white"
                  />
                  <button 
                    type="button"
                    onClick={handleAddTempSubtask}
                    className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold px-3 py-1.5 rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    + Adicionar
                  </button>
                </div>

                {/* Lista de subtarefas adicionadas */}
                {newSubtasks.length > 0 && (
                  <div className="space-y-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 max-h-36 overflow-y-auto">
                    {newSubtasks.map((st, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-2 p-1.5 bg-white rounded-lg border border-slate-100 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-4 h-4 rounded border border-slate-300 flex items-center justify-center text-[10px] text-slate-500">
                            {idx + 1}
                          </span>
                          <span className="truncate text-slate-700">{st}</span>
                        </div>
                        <button 
                          type="button"
                          onClick={() => handleRemoveTempSubtask(idx)}
                          className="text-slate-400 hover:text-rose-600 text-xs p-1 cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Botões do Rodapé do Modal */}
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 shrink-0">
                <button 
                  type="button"
                  onClick={() => setShowNewTaskModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={creatingTask}
                  className="bg-[#002B49] hover:bg-[#003B64] text-white font-bold px-5 py-2 rounded-xl text-xs transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {creatingTask ? 'Registrando...' : 'Criar Tarefa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 6. MODAL: DETALHES E EDIÇÃO DE TAREFA & SUBTAREFAS */}
      {/* ======================================================== */}
      {editingTask && (
        <div ref={editTarefaRef} role="dialog" aria-modal="true" aria-label="Detalhes da tarefa" className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-xl border border-slate-200 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-3 pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  editingTask.status === 'done' 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                    : editingTask.status === 'doing'
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                  {editingTask.status === 'done' ? 'Concluído' : editingTask.status === 'doing' ? 'Em Andamento' : 'A Fazer'}
                </span>
                <h3 className="text-sm font-bold text-[#002B49] m-0">Gerenciar Tarefa #{editingTask.id}</h3>
              </div>
              <button 
                aria-label="Fechar" onClick={() => setEditingTask(null)}
                className="text-slate-500 hover:text-slate-800 text-sm p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSalvarEdicaoTask} className="space-y-3.5 overflow-y-auto flex-1 pr-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Título da Atividade</label>
                <input 
                  type="text" 
                  required
                  value={editTitulo}
                  onChange={(e) => setEditTitulo(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#002B49] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Descrição</label>
                <textarea 
                  rows={2}
                  value={editDescricao}
                  onChange={(e) => setEditDescricao(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#002B49] focus:bg-white resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Atribuído a</label>
                  <select 
                    value={editAssigned}
                    onChange={(e) => setEditAssigned(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-[#002B49]"
                  >
                    <option value="">Equipe Geral</option>
                    <option value={projeto.owner_username}>{projeto.owner_username} (Líder)</option>
                    {membros.map((m, i) => (
                      <option key={i} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Prazo</label>
                  <input 
                    type="date"
                    value={editDeadline}
                    onChange={(e) => setEditDeadline(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-[#002B49]"
                  />
                </div>
              </div>

              {/* GESTÃO DE SUBTAREFAS NO MODAL DE EDIÇÃO */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-[#002B49]">
                    Subtarefas ({editSubtasks.filter(s => s.done).length}/{editSubtasks.length} concluídas)
                  </label>
                </div>

                {/* Campo para adicionar nova subtarefa */}
                <div className="flex gap-2 mb-2">
                  <input 
                    type="text"
                    placeholder="Nova subtarefa e pressione Enter..."
                    value={editNewSubtaskText}
                    onChange={(e) => setEditNewSubtaskText(e.target.value)}
                    onKeyDown={handleAddEditSubtask}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-[#002B49] focus:bg-white"
                  />
                  <button 
                    type="button"
                    onClick={handleAddEditSubtask}
                    className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold px-3 py-1.5 rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    + Adicionar
                  </button>
                </div>

                {/* Lista Interativa de Subtarefas */}
                <div className="space-y-1 bg-slate-50 p-2 rounded-xl border border-slate-200/80 max-h-40 overflow-y-auto">
                  {editSubtasks.length === 0 ? (
                    <div className="text-center py-4 text-xs text-slate-500">Nenhuma subtarefa adicionada.</div>
                  ) : (
                    editSubtasks.map((st, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 p-1.5 bg-white rounded-lg border border-slate-100">
                        <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                          <input 
                            type="checkbox"
                            checked={st.done}
                            onChange={() => handleToggleEditSubtask(i)}
                            className="w-3.5 h-3.5 text-[#002B49] rounded cursor-pointer"
                          />
                          <span className={`text-xs truncate ${st.done ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                            {st.text}
                          </span>
                        </label>
                        <button 
                          type="button"
                          onClick={() => handleRemoveEditSubtask(i)}
                          className="text-slate-400 hover:text-rose-600 text-xs p-1 cursor-pointer"
                          title="Remover subtarefa"
                        >
                          ✕
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Rodapé do Modal */}
              <div className="flex justify-between items-center pt-3 border-t border-slate-100 shrink-0">
                <button 
                  type="button"
                  onClick={() => handleExcluirTask(editingTask.id)}
                  className="text-rose-600 hover:text-rose-800 text-xs font-bold hover:underline cursor-pointer"
                >
                  Excluir Tarefa
                </button>

                <div className="flex gap-2">
                  <button 
                    type="button"
                    onClick={() => setEditingTask(null)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-1.5 rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    Fechar
                  </button>
                  <button 
                    type="submit"
                    disabled={savingEdit}
                    className="bg-[#002B49] hover:bg-[#003B64] text-white font-bold px-4 py-1.5 rounded-xl text-xs transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {savingEdit ? 'Salvando...' : 'Salvar Alterações'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );

  // ========================================================
  // RENDERIZAÇÃO DO CARD DE TAREFA COM SUBTAREFAS
  // ========================================================
  function renderTaskCard(task: TaskItem, columnStatus: 'todo' | 'doing' | 'done') {
    const subtasks = normalizeSubtasks(task.checklist);
    const hasSubtasks = subtasks.length > 0;
    const completedSubtasks = subtasks.filter(s => s.done).length;
    const subtaskPercent = hasSubtasks ? Math.round((completedSubtasks / subtasks.length) * 100) : 0;
    const isExpanded = Boolean(expandedSubtasks[task.id]);

    return (
      <div 
        key={task.id}
        draggable
        onDragStart={() => setDraggedTaskId(task.id)}
        onDragEnd={() => setDraggedTaskId(null)}
        onClick={() => handleOpenEditTask(task)}
        className={`
          bg-white rounded-xl p-3 border transition-all cursor-pointer shadow-2xs hover:shadow-md
          ${draggedTaskId === task.id ? 'opacity-40 scale-98 border-[#002B49]' : 'border-slate-200/90 hover:border-slate-300'}
        `}
      >
        {/* Linha superior: Responsável + Prazo */}
        <div className="flex items-center justify-between gap-2 mb-2">
          {/* Avatar e Responsável */}
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 text-[#002B49] flex items-center justify-center text-[10px] font-bold shrink-0">
              {(task.assigned_username || 'G').substring(0, 1).toUpperCase()}
            </span>
            <span className="text-[11px] font-semibold text-slate-600 truncate max-w-[120px]">
              {task.assigned_username || 'Equipe Geral'}
            </span>
          </div>

          {/* Prazo Limite e Ação de Exclusão */}
          <div className="flex items-center gap-1.5 shrink-0">
            {task.deadline && (
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md ${
                columnStatus === 'done' 
                  ? 'bg-slate-100 text-slate-500'
                  : 'bg-amber-50 text-amber-700 border border-amber-200/60'
              }`}>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>{task.deadline}</span>
              </span>
            )}

            {isOwnerOrAdmin && (
              <button 
                onClick={(e) => handleExcluirTask(task.id, e)}
                title="Excluir tarefa"
                className="text-slate-400 hover:text-rose-600 p-0.5 transition-colors cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Título da Tarefa */}
        <h4 className={`text-xs font-bold leading-snug m-0 mb-1 ${columnStatus === 'done' ? 'line-through text-slate-400' : 'text-slate-800'}`}>
          {task.titulo}
        </h4>

        {/* Descrição Compacta */}
        {task.descricao && (
          <p className="text-[11px] text-slate-500 m-0 mb-2.5 line-clamp-2 leading-relaxed">
            {task.descricao}
          </p>
        )}

        {/* ======================================================== */}
        {/* SEÇÃO DE SUBTAREFAS NO CARD (COM BARRA DE PROGRESSO & EXPANSÃO) */}
        {/* ======================================================== */}
        {hasSubtasks && (
          <div className="mb-2.5 p-2 bg-slate-50 border border-slate-200/70 rounded-lg">
            <div 
              onClick={(e) => toggleSubtasksExpand(task.id, e)}
              className="flex items-center justify-between text-[11px] font-bold text-slate-700 cursor-pointer hover:text-[#002B49]"
            >
              <div className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <span>Subtarefas ({completedSubtasks}/{subtasks.length})</span>
              </div>
              <span className="text-[10px] text-blue-600 font-bold hover:underline">
                {isExpanded ? '▴ Ocultar' : '▾ Ver Lista'}
              </span>
            </div>

            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-1.5">
              <div 
                className={`h-full transition-all duration-300 rounded-full ${subtaskPercent === 100 ? 'bg-emerald-600' : 'bg-blue-600'}`}
                style={{ width: `${subtaskPercent}%` }}
              />
            </div>

            {/* Checkboxes de Subtarefa */}
            {isExpanded && (
              <div className="mt-2 pt-2 border-t border-slate-200/70 space-y-1.5">
                {subtasks.map((st, sIdx) => (
                  <label 
                    key={sIdx}
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-2 text-[11px] text-slate-700 cursor-pointer hover:text-slate-900"
                  >
                    <input 
                      type="checkbox"
                      checked={st.done}
                      onChange={(e) => handleToggleSubtaskOnCard(task, sIdx, e as any)}
                      className="w-3.5 h-3.5 text-[#002B49] rounded cursor-pointer"
                    />
                    <span className={`truncate ${st.done ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                      {st.text}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Rodapé do Card: Ações Rápidas de Movimentação */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-1">
            {columnStatus !== 'todo' && (
              <button 
                onClick={(e) => { e.stopPropagation(); handleMoverTask(task.id, columnStatus === 'done' ? 'doing' : 'todo'); }}
                title="Mover para a etapa anterior"
                className="text-[10px] font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
              >
                ← Voltar
              </button>
            )}
          </div>

          <div className="flex items-center gap-1">
            {columnStatus === 'todo' && (
              <button 
                onClick={(e) => { e.stopPropagation(); handleMoverTask(task.id, 'doing'); }}
                className="text-[10px] font-bold text-white bg-[#002B49] hover:bg-[#003B64] px-2.5 py-0.5 rounded-md transition-colors shadow-2xs cursor-pointer"
              >
                Iniciar →
              </button>
            )}

            {columnStatus === 'doing' && (
              <button 
                onClick={(e) => { e.stopPropagation(); handleMoverTask(task.id, 'done'); }}
                className="text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-2.5 py-0.5 rounded-md transition-colors shadow-2xs flex items-center gap-1 cursor-pointer"
              >
                <span>Concluir</span>
                <span>✓</span>
              </button>
            )}

            {columnStatus === 'done' && (
              <button 
                onClick={(e) => { e.stopPropagation(); handleMoverTask(task.id, 'doing'); }}
                className="text-[10px] font-bold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
              >
                ↺ Reabrir
              </button>
            )}
          </div>
        </div>

      </div>
    );
  }
}
