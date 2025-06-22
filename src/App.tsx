import { useEffect, useState } from 'react';
import { db } from './firebase';
import { collection, getDocs } from 'firebase/firestore';
import { Bar } from 'react-chartjs-2';
import 'chart.js/auto';
import { format, isWithinInterval } from 'date-fns';
import type { TooltipItem } from 'chart.js';
import './app.css';

type Relatorio = {
  fileDurations: Record<string, number>;
  activityLog: {
    time: string;
    action: string;
    file: string;
    duration?: string;
  }[];
  inactivityDuration: number;
  timestamp: string;
  userId: string;
  projeto?: string;
};

function formatTime(ms: number): string {
  const sec = Math.floor(ms / 1000) % 60;
  const min = Math.floor(ms / (1000 * 60)) % 60;
  const hours = Math.floor(ms / (1000 * 60 * 60));
  return `${String(hours).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function App() {
  const [relatorios, setRelatorios] = useState<Relatorio[]>([]);
  const [userId, setUserId] = useState('');
  const [users, setUsers] = useState<string[]>([]);
  const [projectName, setProjectName] = useState('');
  const [projects, setProjects] = useState<string[]>([]);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [selectedActions, setSelectedActions] = useState<string[]>([]);

  useEffect(() => {
    const fetch = async () => {
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

    fetch();
  }, []);

  const hoje = new Date();
  const inicioPadrao = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const fimPadrao = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59);

  const dadosFiltrados = relatorios.filter(r => {
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

  const totalProdutivoMs = dadosFiltrados.reduce((acc, r) =>
    acc + Object.values(r.fileDurations).reduce((a, b) => a + b, 0)
  , 0);

  const totalInatividadeMs = dadosFiltrados.reduce((acc, r) =>
    acc + r.inactivityDuration, 0
  );

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
    }).length
  , 0);

  const totalTempo = totalProdutivoMs + totalInatividadeMs;
  const percentualProdutivo = totalTempo ? (totalProdutivoMs / totalTempo) * 100 : 0;

  const totalPorArquivo: Record<string, number> = {};
  dadosFiltrados.forEach(r => {
    Object.entries(r.fileDurations).forEach(([arquivo, tempo]) => {
      totalPorArquivo[arquivo] = (totalPorArquivo[arquivo] || 0) + tempo;
    });
  });

  const chartData = {
    labels: Object.keys(totalPorArquivo).map(a => a.split(/[/\\]/).pop()),
    datasets: [
      {
        label: 'Tempo de Edição (hh:mm:ss)',
        data: Object.values(totalPorArquivo).map(ms => ms / 1000),
        backgroundColor: '#60a5fa'
      }
    ]
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

  return (
    <div className="container">
      <h1>Painel de Relatórios</h1>

      <div className="kpis">
        <div className="kpi"><h3>Tempo Produtivo</h3><p>{formatTime(totalProdutivoMs)}</p></div>
        <div className="kpi"><h3>Inatividade</h3><p>{formatTime(totalInatividadeMs)}</p></div>
        <div className="kpi"><h3>Arquivos Editados</h3><p>{totalArquivosEditados}</p></div>
        <div className="kpi"><h3>Registros</h3><p>{totalAcoes}</p></div>
      </div>

      <div className="regua">
        <div className="regua-bar">
          <div className="produtivo" style={{ width: `${percentualProdutivo}%` }} />
          <div className="inativo" style={{ width: `${100 - percentualProdutivo}%` }} />
        </div>
        <p>{percentualProdutivo.toFixed(1)}% produtivo</p>
      </div>

      <div className="filtros">
        <label>Usuário:</label>
        <select value={userId} onChange={e => setUserId(e.target.value)}>
          <option value="">Todos</option>
          {users.map(u => <option key={u} value={u}>{u}</option>)}
        </select>

        <label>Projeto:</label>
        <select value={projectName} onChange={e => setProjectName(e.target.value)}>
          <option value="">Todos</option>
          {projects.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        <label>De:</label>
        <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className='input'/>

        <label>Até:</label>
        <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className='input'/>
      </div>

      <div className="grafico">
        <Bar data={chartData} options={chartOptions} />
      </div>

      <h2>Atividades Recentes</h2>

      <div className="filtros">
        <label>Tipo de Ação:</label>
        {Array.from(new Set(dadosFiltrados.flatMap(r => r.activityLog.map(log => log.action)))).map(tipo => (
          <label key={tipo}>
            <input
              type="checkbox"
              checked={selectedActions.includes(tipo)}
              onChange={() => {
                setSelectedActions(prev =>
                  prev.includes(tipo)
                    ? prev.filter(t => t !== tipo)
                    : [...prev, tipo]
                );
              }}
            />
            {' '}{tipo}
          </label>
        ))}
      </div>

      <ul className="log">
        {dadosFiltrados.flatMap(r =>
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
              const dentroTipo = selectedActions.length === 0 || selectedActions.includes(log.action);
              return dentroData && dentroTipo;
            })
            .map(log => (
              <li key={`${log.time}-${log.action}-${log.file}`}>
                {format(new Date(log.time), 'dd/MM/yyyy HH:mm:ss')} — <strong>{log.action}</strong> em <em>{log.file.split(/[/\\]/).pop()}</em> {log.duration && ` (${log.duration})`}
              </li>
            ))
        )}
      </ul>

      <p>Total: {
        dadosFiltrados.reduce((acc, r) =>
          acc + r.activityLog.filter(log => {
            const data = new Date(log.time);
            const dentroData =
              (!dataInicio || !dataFim)
                ? isWithinInterval(data, { start: inicioPadrao, end: fimPadrao })
                : isWithinInterval(data, {
                    start: new Date(dataInicio),
                    end: new Date(dataFim + 'T23:59:59')
                  });
            const dentroTipo = selectedActions.length === 0 || selectedActions.includes(log.action);
            return dentroData && dentroTipo;
          }).length
        , 0)
      } registros exibidos</p>

      <button onClick={() => {
        const data = JSON.stringify(dadosFiltrados, null, 2);
        const blob = new Blob([data], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "relatorio.json";
        a.click();
      }}>
        Exportar JSON
      </button>
    </div>
  );
}

export default App;
