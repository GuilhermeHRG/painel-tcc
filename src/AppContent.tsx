import { useEffect, useState } from 'react';
import { db } from './firebase';
import { collection, getDocs } from 'firebase/firestore';
import { Bar } from 'react-chartjs-2';
import 'chart.js/auto';
import { format, isWithinInterval } from 'date-fns';
import type { TooltipItem } from 'chart.js';
import './App.css';
import { signOut } from "firebase/auth";
import { auth } from "./firebase";
import { useNavigate } from "react-router-dom";
import logo from '../public/logo-time-to-code.png';

type ActivityLog = {
  time: string;
  action: string;
  file: string;
  duration?: string;
};

type Relatorio = {
  fileDurations: Record<string, number>;
  activityLog: ActivityLog[];
  inactivityDuration: number;
  timestamp: string;
  userId: string;
  projeto?: string;
};

const formatTime = (ms: number): string => {
  const sec = Math.floor(ms / 1000) % 60;
  const min = Math.floor(ms / (1000 * 60)) % 60;
  const hours = Math.floor(ms / (1000 * 60 * 60));
  return `${String(hours).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

const useRelatoriosData = () => {
  const [relatorios, setRelatorios] = useState<Relatorio[]>([]);
  const [users, setUsers] = useState<string[]>([]);
  const [projects, setProjects] = useState<string[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const ref = collection(db, 'relatorios');
      const snapshot = await getDocs(ref);
      const dados: Relatorio[] = [];
      const usersSet = new Set<string>();
      const projectsSet = new Set<string>();

      snapshot.forEach((doc) => {
        const data = doc.data() as Relatorio;
        dados.push(data);
        usersSet.add(data.userId);
        projectsSet.add(data.projeto || 'sem-projeto');
      });

      setUsers(Array.from(usersSet));
      setProjects(Array.from(projectsSet));
      setRelatorios(dados);
    };

    fetchData();
  }, []);

  return { relatorios, users, projects };
};

const useFilteredData = (
  relatorios: Relatorio[],
  userId: string,
  projectName: string,
  dataInicio: string,
  dataFim: string
) => {
  const hoje = new Date();
  const inicioPadrao = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const fimPadrao = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59);

  return relatorios.filter(r => {
    const dentroDoUsuario = !userId || r.userId === userId;
    const dentroDoProjeto = !projectName || r.projeto === projectName;

    const dataRegistro = new Date(r.timestamp);
    const dentroDaData =
      (!dataInicio && !dataFim)
        ? isWithinInterval(dataRegistro, { start: inicioPadrao, end: fimPadrao })
        : isWithinInterval(dataRegistro, {
          start: dataInicio ? new Date(dataInicio) : new Date('2000-01-01'),
          end: dataFim ? new Date(dataFim + 'T23:59:59') : new Date('2100-01-01')
        });

    return dentroDoUsuario && dentroDaData && dentroDoProjeto;
  });
};

const calculateMetrics = (dadosFiltrados: Relatorio[], dataInicio: string, dataFim: string) => {
  const hoje = new Date();
  const inicioPadrao = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const fimPadrao = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59);

  const totalProdutivoMs = dadosFiltrados.reduce((acc, r) =>
    acc + Object.values(r.fileDurations).reduce((a, b) => a + b, 0), 0);

  const totalInatividadeMs = dadosFiltrados.reduce((acc, r) =>
    acc + r.inactivityDuration, 0);

  const totalArquivosEditados = new Set(
    dadosFiltrados.flatMap(r => Object.keys(r.fileDurations))
  ).size;

  const totalAcoes = dadosFiltrados.reduce((acc, r) =>
    acc + r.activityLog.filter(log => {
      const data = new Date(log.time);
      const dentroData =
        (!dataInicio || !dataFim)
          ? isWithinInterval(data, { start: inicioPadrao, end: fimPadrao })
          : isWithinInterval(data, {
            start: new Date(dataInicio),
            end: new Date(dataFim + 'T23:59:59'),
          });
      return dentroData;
    }).length, 0);

  const totalTempo = totalProdutivoMs + totalInatividadeMs;
  const percentualProdutivo = totalTempo ? (totalProdutivoMs / totalTempo) * 100 : 0;

  return {
    totalProdutivoMs,
    totalInatividadeMs,
    totalArquivosEditados,
    totalAcoes,
    percentualProdutivo
  };
};

const prepareChartData = (dadosFiltrados: Relatorio[]) => {
  const totalPorArquivo: Record<string, number> = {};
  dadosFiltrados.forEach(r => {
    Object.entries(r.fileDurations).forEach(([arquivo, tempo]) => {
      totalPorArquivo[arquivo] = (totalPorArquivo[arquivo] || 0) + tempo;
    });
  });

  return {
    labels: Object.keys(totalPorArquivo).map(a => a.split(/[/\\]/).pop()),
    datasets: [
      {
        label: 'Tempo de Edição (hh:mm:ss)',
        data: Object.values(totalPorArquivo).map(ms => ms / 1000),
        backgroundColor: '#60a5fa'
      }
    ]
  };
};

const chartOptions = {
  responsive: true,
  plugins: {
    tooltip: {
      callbacks: {
        label: function (context: TooltipItem<'bar'>) {
          const ms = (context.raw as number) * 1000;
          return `Tempo: ${formatTime(ms)}`;
        }
      }
    }
  }
};

const Header = ({ onLogout }: { onLogout: () => void }) => (
  <header className="header">
    <div className="header-content">
      <img src={logo} alt="Logo" className="header-logo" />
      <h2 className="header-title">Painel de relatórios</h2>
    </div>
    <button className="header-logout" onClick={onLogout}>
      Sair
    </button>
  </header>
);

const KPICard = ({ title, value }: { title: string; value: string | number }) => (
  <div className="kpi">
    <h3>{title}</h3>
    <p>{value}</p>
  </div>
);

const FilterSection = ({
  userId,
  setUserId,
  users,
  projectName,
  setProjectName,
  projects,
  dataInicio,
  setDataInicio,
  dataFim,
  setDataFim
}: {
  userId: string;
  setUserId: (value: string) => void;
  users: string[];
  projectName: string;
  setProjectName: (value: string) => void;
  projects: string[];
  dataInicio: string;
  setDataInicio: (value: string) => void;
  dataFim: string;
  setDataFim: (value: string) => void;
}) => (
  <section className="filtros">
    <label>
      Usuário:
      <select value={userId} onChange={e => setUserId(e.target.value)}>
        <option value="">Todos</option>
        {users.map(u => <option key={u} value={u}>{u}</option>)}
      </select>
    </label>

    <label>
      Projeto:
      <select value={projectName} onChange={e => setProjectName(e.target.value)}>
        <option value="">Todos</option>
        {projects.map(p => <option key={p} value={p}>{p}</option>)}
      </select>
    </label>

    <label>
      De:
      <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
    </label>

    <label>
      Até:
      <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} />
    </label>
  </section>
);

const ProductivityBar = ({ percentual }: { percentual: number }) => (
  <section className="regua">
    <div className="regua-bar">
      <div className="produtivo" style={{ width: `${percentual}%` }} />
      <div className="inativo" style={{ width: `${100 - percentual}%` }} />
    </div>
    <p>{percentual.toFixed(1)}% produtivo nesta data</p>
  </section>
);

const ActionTypeFilter = ({
  actionTypes,
  selectedActions,
  setSelectedActions
}: {
  actionTypes: string[];
  selectedActions: string[];
  setSelectedActions: React.Dispatch<React.SetStateAction<string[]>>;
}) => (
  <section className="filtros">
    <label>Tipo de Ação:</label>
    {actionTypes.map(tipo => (
      <label key={tipo}>
        <input
          type="checkbox"
          checked={selectedActions.includes(tipo)}
          onChange={() => {
            setSelectedActions((prev: string[]) => 
              prev.includes(tipo)
                ? prev.filter((t: string) => t !== tipo)
                : [...prev, tipo]
            );
          }}
        />{' '}{tipo}
      </label>
    ))}
  </section>
);

const ActivityLogList = ({
  logs,
  totalRecords
}: {
  logs: ActivityLog[];
  totalRecords: number;
}) => (
  <>
    <ul className="log">
      {logs.map((log, index) => (
        <li key={index}>
          {format(new Date(log.time), 'dd/MM/yyyy HH:mm:ss')} — 
          <strong>{log.action}</strong> em <em>{log.file.split(/[/\\]/).pop()}</em> 
          {log.duration && ` (${log.duration})`}
        </li>
      ))}
    </ul>
    <p>Total: {totalRecords} registros exibidos</p>
  </>
);

const AppContent = () => {
  const [userId, setUserId] = useState('');
  const [projectName, setProjectName] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [selectedActions, setSelectedActions] = useState<string[]>([]);
  
  const navigate = useNavigate();
  const { relatorios, users, projects } = useRelatoriosData();
  const dadosFiltrados = useFilteredData(relatorios, userId, projectName, dataInicio, dataFim);
  
  const {
    totalProdutivoMs,
    totalInatividadeMs,
    totalArquivosEditados,
    totalAcoes,
    percentualProdutivo
  } = calculateMetrics(dadosFiltrados, dataInicio, dataFim);
  
  const chartData = prepareChartData(dadosFiltrados);
  
  const actionTypes = Array.from(new Set(
    dadosFiltrados.flatMap(r => r.activityLog.map(log => log.action.trim()))
  ));
  
  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  
  const hoje = new Date();
  const inicioPadrao = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const fimPadrao = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59);
  
  const filteredLogs = dadosFiltrados.flatMap(r =>
    r.activityLog
      .filter(log => {
        const data = new Date(log.time);
        const dentroData =
          (!dataInicio || !dataFim)
            ? isWithinInterval(data, { start: inicioPadrao, end: fimPadrao })
            : isWithinInterval(data, {
              start: new Date(dataInicio),
              end: new Date(dataFim + 'T23:59:59')
            });

        const logAction = log.action.trim().toLowerCase();
        const dentroTipo =
          selectedActions.length === 0 ||
          selectedActions.map(a => a.toLowerCase()).includes(logAction);

        return dentroData && dentroTipo;
      })
      .map((log, logIndex) => ({
        ...log,
        key: `${r.userId}-${r.timestamp}-${logIndex}`
      }))
  );
  
  const totalRecords = filteredLogs.length;
  
  const handleExport = () => {
    const data = JSON.stringify(dadosFiltrados, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "relatorio.json";
    a.click();
  };

  return (
    <div className="main-content">
      
      
      <Header 
        onLogout={handleLogout} 
      />
      
      <main className="container">
        
        <section className="kpis">
          <KPICard title="Tempo Produtivo" value={formatTime(totalProdutivoMs)} />
          <KPICard title="Inatividade" value={formatTime(totalInatividadeMs)} />
          <KPICard title="Arquivos Editados" value={totalArquivosEditados} />
          <KPICard title="Registros" value={totalAcoes} />
        </section>
        
        <FilterSection
          userId={userId}
          setUserId={setUserId}
          users={users}
          projectName={projectName}
          setProjectName={setProjectName}
          projects={projects}
          dataInicio={dataInicio}
          setDataInicio={setDataInicio}
          dataFim={dataFim}
          setDataFim={setDataFim}
        />
        
        <ProductivityBar percentual={percentualProdutivo} />
        
        <section className="grafico">
          <Bar data={chartData} options={chartOptions} />
        </section>
        
        <h2>Atividades Recentes</h2>
        
        <ActionTypeFilter
          actionTypes={actionTypes}
          selectedActions={selectedActions}
          setSelectedActions={setSelectedActions}
        />
        
        <ActivityLogList
          logs={filteredLogs}
          totalRecords={totalRecords}
        />
        
        <button onClick={handleExport}>
          Exportar JSON
        </button>
      </main>
    </div>
  );
};

export default AppContent;