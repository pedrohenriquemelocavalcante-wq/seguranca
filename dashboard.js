$(document).ready(function () {
    // --- CONFIGURAÇÃO PRINCIPAL ---
    const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyGqYEKntIeeXk81hq8uOAFosOqlHHS2Kz9KIy64BWmXG4IQ-53n0wFgZ4gG3VOrY0H/exec";

    let quadroDeFuncionarios = [];
    let dadosDosRelatos = [];
    let dadosManuais = [];
    let funcionariosMetaCache = [];

    // --- FUNÇÃO AUXILIAR PARA CORRIGIR DATAS ---
    function formatarData(dataString) {
        if (!dataString) return 'N/A';
        const data = new Date(dataString);
        if (isNaN(data.getTime())) { return 'Data Inválida'; }
        const dia = String(data.getUTCDate()).padStart(2, '0');
        const mes = String(data.getUTCMonth() + 1).padStart(2, '0');
        const ano = data.getUTCFullYear();
        return `${dia}/${mes}/${ano}`;
    }

    async function iniciarDashboard() {
        const pontoDeInjecao = $('#td0id_do_seu_campo_aqui');
        if (pontoDeInjecao.length === 0) return;

        pontoDeInjecao.html(criarEstruturaHTML());
        $('#dashboard-app').hide();
        pontoDeInjecao.append('<h3 id="loading-message" style="font-family: Segoe UI, sans-serif; color: #e2e8f0;">Carregando dashboard, por favor aguarde...</h3>');

        try {
            const response = await fetch(`${SCRIPT_URL}?request_type=dashboard_data`);
            if (!response.ok) throw new Error(`Erro na rede: ${response.statusText}`);
            const data = await response.json();
            if (data.status === 'erro') throw new Error(`Erro no script do Google: ${data.message}`);
            
            quadroDeFuncionarios = data.employees;
            dadosDosRelatos = data.reports;
            dadosManuais = data.manualData || [];

            $('#loading-message').hide();
            $('#dashboard-app').show();
            
            popularMenuLateral();
            configurarMenuLateral();
            processarEExibirDados('Todos', 'Todos'); 

        } catch (error) {
            $('#loading-message').html(`<div style="color: #f56565; background: #4a5568; border: 1px solid #f56565; padding: 15px; border-radius: 8px;"><strong>Falha ao carregar o dashboard.</strong><br><p>Erro: ${error.message}</p></div>`);
        }
    }

    function popularMenuLateral() {
        const setoresUnicos = ['Todos', ...[...new Set(quadroDeFuncionarios.map(item => item.setor))].filter(Boolean).sort()];
        const menuSetores = $('#menu-setores');
        menuSetores.empty();
        setoresUnicos.forEach(setor => {
            const nomeExibicao = setor === 'Todos' ? 'Visão Geral' : setor;
            const item = $(`<li class="menu-item"><a href="#" data-filtro-tipo="setor" data-valor="${setor}">${nomeExibicao}</a></li>`);
            if (setor === 'Todos') {
                item.find('a').addClass('active');
            }
            menuSetores.append(item);
        });

        const mesesUnicos = ['Todos', ...[...new Set(dadosDosRelatos.map(r => r.dataDaSolicitacao ? r.dataDaSolicitacao.substring(0, 7) : ''))].filter(Boolean).sort().reverse()];
        const menuMesAno = $('#menu-mes-ano');
        menuMesAno.empty();
        mesesUnicos.forEach(mesAno => {
            const [ano, mes] = mesAno.split('-');
            const nomeExibicao = mesAno === 'Todos' ? 'Todo o Período' : `${mes}/${ano}`;
            const item = $(`<li class="menu-item"><a href="#" data-filtro-tipo="mes" data-valor="${mesAno}">${nomeExibicao}</a></li>`);
            if (mesAno === 'Todos') {
                item.find('a').addClass('active');
            }
            menuMesAno.append(item);
        });
    }

    function configurarMenuLateral() {
        $('#sidebar').on('click', '.menu-item a', function(e) {
            e.preventDefault();
            const linkClicado = $(this);
            const tipoFiltro = linkClicado.data('filtro-tipo');
            
            if (tipoFiltro === 'setor') {
                $('#menu-setores .menu-item a').removeClass('active');
            } else {
                $('#menu-mes-ano .menu-item a').removeClass('active');
            }
            linkClicado.addClass('active');

            const filtroSetorAtivo = $('#menu-setores .menu-item a.active').data('valor');
            const filtroMesAnoAtivo = $('#menu-mes-ano .menu-item a.active').data('valor');
            
            processarEExibirDados(filtroSetorAtivo, filtroMesAnoAtivo);
        });
    }
    
    function processarEExibirDados(filtroSetor, filtroMesAno) {
        let funcionariosFiltrados = quadroDeFuncionarios;
        if (filtroSetor !== 'Todos') {
            funcionariosFiltrados = funcionariosFiltrados.filter(f => f.setor === filtroSetor);
        }
        
        const nomesFuncionariosFiltrados = funcionariosFiltrados.map(f => f.nome);
        let relatosFiltrados = dadosDosRelatos.filter(r => nomesFuncionariosFiltrados.includes(r.criador));

        if (filtroMesAno !== 'Todos') {
            relatosFiltrados = relatosFiltrados.filter(r => r.dataDaSolicitacao && r.dataDaSolicitacao.startsWith(filtroMesAno));
        }

        const totalFuncionarios = funcionariosFiltrados.length;
        const totalRelatos = relatosFiltrados.length;
        const funcionariosQueRelataram = new Set(relatosFiltrados.map(r => r.criador));
        const taxaEngajamento = totalFuncionarios > 0 ? ((funcionariosQueRelataram.size / totalFuncionarios) * 100).toFixed(0) : 0;
        $('#total-funcionarios').text(totalFuncionarios);
        $('#total-relatos').text(totalRelatos);
        $('#taxa-engajamento').text(`${taxaEngajamento}%`);
        
        const atosInseguros = relatosFiltrados.filter(r => r.tipoDoRelato === 'Ato Inseguro' && r.tipoDoAtoInseguro);
        const topAtoInseguro = calcularTop(atosInseguros, 'tipoDoAtoInseguro', 1);
        const comportamentoCritico = topAtoInseguro.length > 0 ? topAtoInseguro[0].item : 'N/A';
        $('#valor-ato-critico').text(comportamentoCritico);
        
        renderizarPiramideDeSeguranca(relatosFiltrados, filtroSetor, filtroMesAno);
        renderizarGraficosPrincipais(relatosFiltrados, filtroMesAno);
        renderizarTop5(relatosFiltrados);

        const setoresComMeta = { 'APOIO LOGISTICO': 3, 'ENTREGA': 3, 'PUXADA': 3 };
        if (filtroMesAno !== 'Todos' && setoresComMeta.hasOwnProperty(filtroSetor)) {
            $('#layout-padrao-centro').hide();
            $('#layout-metas-centro').show();
            renderizarAcompanhamentoDeMetas(relatosFiltrados, funcionariosFiltrados, filtroSetor, setoresComMeta[filtroSetor]);
        } else {
            $('#layout-metas-centro').hide();
            $('#layout-padrao-centro').show();
            renderizarTabelasPadrao(relatosFiltrados);
        }
    }

    function renderizarPiramideDeSeguranca(relatosFiltrados, filtroSetor, filtroMesAno) {
        const contagemAutomatica = { incidente: 0, atoInseguro: 0, condicaoInsegura: 0, atoPositivo: 0 };
        relatosFiltrados.forEach(relato => {
            switch (relato.tipoDoRelato) {
                case 'Incidente': contagemAutomatica.incidente++; break;
                case 'Ato Inseguro': contagemAutomatica.atoInseguro++; break;
                case 'Condição Insegura': contagemAutomatica.condicaoInsegura++; break;
                case 'Ato Positivo': contagemAutomatica.atoPositivo++; break;
            }
        });

        const contagemManual = { lti: 0, mdi: 0, mti: 0, fai: 0 };
        if (filtroMesAno !== 'Todos') {
            const [ano, mes] = filtroMesAno.split('-');
            const mesAnoFormatado = `${mes}/${ano}`;
            const setorBusca = filtroSetor === 'Todos' ? 'Geral' : filtroSetor;
            const registroManual = dadosManuais.find(d => d.MesAno === mesAnoFormatado && d.Setor && d.Setor.toLowerCase() === setorBusca.toLowerCase());
            if (registroManual) {
                contagemManual.lti = registroManual.LTI || 0;
                contagemManual.mdi = registroManual.MDI || 0;
                contagemManual.mti = registroManual.MTI || 0;
                contagemManual.fai = registroManual.FAI || 0;
            }
        }
        $('#pyramid-count-lti').text(contagemManual.lti);
        $('#pyramid-count-mdi').text(contagemManual.mdi);
        $('#pyramid-count-mti').text(contagemManual.mti);
        $('#pyramid-count-fai').text(contagemManual.fai);
        $('#pyramid-count-incidente').text(contagemAutomatica.incidente);
        $('#pyramid-count-ato-inseguro').text(contagemAutomatica.atoInseguro);
        $('#pyramid-count-condicao-insegura').text(contagemAutomatica.condicaoInsegura);
        $('#pyramid-count-ato-positivo').text(contagemAutomatica.atoPositivo);
    }

    function calcularTop(dados, coluna, limite) {
        if (!dados || dados.length === 0) return [];
        const contagem = dados.reduce((acc, item) => {
            const valor = item[coluna];
            if (valor) acc[valor] = (acc[valor] || 0) + 1;
            return acc;
        }, {});
        return Object.entries(contagem).sort(([, a], [, b]) => b - a).slice(0, limite).map(([item, contagem]) => ({ item, contagem }));
    }

    function renderizarTop5(relatosFiltrados) {
        const colunasTop5 = ['tipoDaCondicaoInsegura', 'tipoDoAtoInseguro', 'tipoDoAcidente', 'tipoDoIncidente', 'tipoDoAtoPositivo'];
        colunasTop5.forEach(coluna => {
            const dadosTop = calcularTop(relatosFiltrados, coluna, 5);
            const tbody = $(`#tabela-top-${coluna} tbody`);
            tbody.empty();
            if (dadosTop.length === 0) {
                tbody.html('<tr><td colspan="2" style="text-align:center; font-style:italic; color:#999;">Sem dados.</td></tr>');
            } else {
                dadosTop.forEach(d => tbody.append(`<tr><td>${d.item}</td><td style="text-align:center;">${d.contagem}</td></tr>`));
            }
        });
    }
    
    function renderizarAcompanhamentoDeMetas(relatosFiltrados, funcionariosDoSetor, filtroSetor, metaIndividual) {
        let contagemTotalCapada = 0;
        
        funcionariosMetaCache = funcionariosDoSetor.map(func => {
            const relatosFuncionario = relatosFiltrados.filter(r => r.criador === func.nome).length;
            const contribuicao = Math.min(relatosFuncionario, metaIndividual);
            contagemTotalCapada += contribuicao;
            return {
                nome: func.nome,
                relatos: relatosFuncionario,
                status: relatosFuncionario >= metaIndividual ? 'atingiu' : 'pendente'
            };
        }).sort((a,b) => b.relatos - a.relatos);

        const metaTotalSetor = funcionariosDoSetor.length * metaIndividual;
        const porcentagemTotal = metaTotalSetor > 0 ? (contagemTotalCapada / metaTotalSetor) * 100 : 0;

        $('#meta-progresso-titulo').text(`Acompanhamento de Metas: ${filtroSetor}`);
        $('#meta-progresso-label').html(`<span>Progresso Total (Contribuição)</span><span>${contagemTotalCapada} / ${metaTotalSetor}</span>`);
        $('#meta-progresso-barra').css('width', `${porcentagemTotal}%`);
        
        $('#meta-sub-filtro .meta-filtro-btn').off('click').on('click', function() {
            $('#meta-sub-filtro .meta-filtro-btn').removeClass('active');
            $(this).addClass('active');
            const filtro = $(this).data('filtro');
            atualizarListaFuncionariosMeta(filtro);
        });
        
        $('#meta-sub-filtro .meta-filtro-btn').removeClass('active');
        $('#meta-sub-filtro .meta-filtro-btn[data-filtro="todos"]').addClass('active');
        atualizarListaFuncionariosMeta('todos');
    }

    function atualizarListaFuncionariosMeta(filtro) {
        const listaFiltrada = funcionariosMetaCache.filter(f => {
            if (filtro === 'todos') return true;
            return f.status === filtro;
        });

        let listaHtml = '';
        if (listaFiltrada.length === 0) {
            listaHtml = '<li class="detalhe-item-meta" style="justify-content:center;">Nenhum funcionário nesta categoria.</li>';
        } else {
            listaFiltrada.forEach(func => {
                const icone = func.status === 'atingiu' ? '✔️' : '❌';
                listaHtml += `<li class="detalhe-item-meta"><span>${icone} ${func.nome}</span><span class="relatos-count">${func.relatos}</span></li>`;
            });
        }
        $('#lista-funcionarios-meta').html(listaHtml);
    }
    
    function renderizarTabelasPadrao(relatosFiltrados) {
        const linhasTabelaDetalhe = relatosFiltrados.slice(0, 10).map(r => `<tr><td>${formatarData(r.dataDaSolicitacao)}</td><td>${r.criador || ''}</td><td>${r.tipoDoRelato || ''}</td></tr>`).join('');
        $('#tabela-detalhe-relatos-padrão tbody').html(linhasTabelaDetalhe);

        const rankingData = relatosFiltrados.reduce((acc, r) => {
            if(r.criador) acc[r.criador] = (acc[r.criador] || 0) + 1;
            return acc;
        }, {});
        const linhasTabelaRanking = Object.entries(rankingData).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([nome, qtde], i) => `<tr><td><b>${i + 1}</b></td><td>${nome}</td><td>${qtde}</td></tr>`).join('');
        $('#tabela-ranking-padrão tbody').html(linhasTabelaRanking);
    }

    function renderizarGraficosPrincipais(relatosFiltrados, filtroMesAno) {
        const mesesBase = [...new Set(dadosDosRelatos.map(r => r.dataDaSolicitacao ? r.dataDaSolicitacao.substring(0, 7) : ''))].filter(Boolean).sort();
        const dadosEvolucaoMensal = mesesBase.map(mes => ({
            mes: mes.split('-')[1] + "/" + mes.split('-')[0].slice(2),
            relatos: dadosDosRelatos.filter(r => r.dataDaSolicitacao && r.dataDaSolicitacao.startsWith(mes)).length
        }));
        const todosSetoresUnicos = [...new Set(quadroDeFuncionarios.map(f => f.setor))].filter(Boolean).sort();
        const relatosPorSetor = todosSetoresUnicos.reduce((acc, setor) => {
            const funcionariosDoSetor = quadroDeFuncionarios.filter(f => f.setor === setor);
            const nomesDoSetor = funcionariosDoSetor.map(f => f.nome);
            let relatosGerais = filtroMesAno === 'Todos' ? dadosDosRelatos : dadosDosRelatos.filter(r => r.dataDaSolicitacao && r.dataDaSolicitacao.startsWith(filtroMesAno));
            acc[setor] = relatosGerais.filter(r => nomesDoSetor.includes(r.criador)).length;
            return acc;
        }, {});
        
        renderizarGraficoLinha(dadosEvolucaoMensal);
        renderizarGraficoColunas(relatosPorSetor);
        renderizarGraficoPizza(relatosFiltrados);
    }
    
    function renderizarGraficoLinha(dados) {
        const ctx = document.getElementById('grafico-evolucao-linha').getContext('2d');
        if (window.myLineChart) window.myLineChart.destroy();
        window.myLineChart = new Chart(ctx, { type: 'line', data: { labels: dados.map(d => d.mes), datasets: [{ label: 'Relatos por Mês', data: dados.map(d => d.relatos), borderColor: '#81e6d9', backgroundColor: 'rgba(129, 230, 217, 0.1)', fill: true, tension: 0.4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, title: { display: true, text: 'Evolução Mensal de Relatos', font: { size: 14 }, color: '#e2e8f0' } }, scales: { x: { ticks: { color: '#a0aec0' } }, y: { ticks: { color: '#a0aec0' }, grid: { color: '#4a5568' } } } } });
    }

    function renderizarGraficoColunas(dados) {
        const ctx = document.getElementById('grafico-aderencia-colunas').getContext('2d');
        if (window.myColumnChart) window.myColumnChart.destroy();
        window.myColumnChart = new Chart(ctx, { type: 'bar', data: { labels: Object.keys(dados), datasets: [{ label: 'Total de Relatos', data: Object.values(dados), backgroundColor: '#63b3ed' }] }, options: { responsive: true, maintainAspectRatio: false, scales: { x: { ticks: { color: '#a0aec0' } }, y: { beginAtZero: true, ticks: { stepSize: 1, color: '#a0aec0' }, grid: { color: '#4a5568' } } }, plugins: { legend: { display: false }, title: { display: true, text: 'Total de Relatos por Setor', font: { size: 14 }, color: '#e2e8f0' } } } });
    }

    function renderizarGraficoPizza(relatos) {
        const ctx = document.getElementById('grafico-tipo-relato').getContext('2d');
        if (window.myPieChart) window.myPieChart.destroy();
        let tipos = {};
        relatos.forEach(r => { if(r.tipoDoRelato) tipos[r.tipoDoRelato] = (tipos[r.tipoDoRelato] || 0) + 1; });
        window.myPieChart = new Chart(ctx, { type: 'doughnut', data: { labels: Object.keys(tipos), datasets: [{ data: Object.values(tipos), backgroundColor: ["#63b3ed", "#68d391", "#f6ad55", "#fc8181", "#b794f4", "#4fd1c5"] }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#a0aec0' } }, title: { display: true, text: 'Distribuição dos Tipos de Relato', font: { size: 14 }, color: '#e2e8f0' } } } });
    }
    
    function criarEstruturaHTML() { return `
        <style>
            .dashboard-body { display: flex; font-family: 'Segoe UI', sans-serif; background: #2d3748; padding: 24px; border-radius: 18px; }
            #sidebar { width: 220px; flex-shrink: 0; border-right: 2px solid #4a5568; padding-right: 20px; }
            .sidebar-header { text-align: center; margin-bottom: 25px; }
            .logo { max-width: 200px; height: auto; margin-bottom: 15px; }
            #sidebar h3 { color: #a0aec0; font-size: 1rem; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 15px; border-top: 1px solid #4a5568; padding-top: 20px;}
            .menu-list { list-style: none; padding: 0; margin: 0 0 30px 0; }
            .menu-item a { color: #cbd5e0; text-decoration: none; display: block; padding: 10px 15px; border-radius: 8px; font-weight: 500; }
            .menu-item a:hover { background: #4a5568; }
            .menu-item a.active { background: #3182ce; color: #fff; font-weight: bold; }
            #main-content { flex-grow: 1; padding-left: 24px; }
            .cards-resumo { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 18px; margin-bottom: 28px; }
            .card { background: #fff; border-radius: 10px; padding: 18px; }
            .card h4 { color: #718096; font-size: 13px; font-weight: 600; margin: 0 0 4px 0; text-transform: uppercase; }
            .card .valor { color: #3182ce; font-size: 26px; font-weight: 700; word-wrap: break-word; }
            .main-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
            .grid-item { background: #4a5568; border-radius: 10px; padding: 16px; min-height: 380px; display: flex; flex-direction: column; }
            .grid-item h5 { margin-top: 0; margin-bottom: 15px; color: #e2e8f0; text-align: center; border-bottom: 1px solid #5a6578; padding-bottom: 10px;}
            .grid-item.full-width { grid-column: 1 / -1; min-height: auto; }
            .chart-container { flex-grow: 1; position: relative; }
            .pyramid-container { padding: 10px; background: transparent; }
            .pyramid-level { display: flex; justify-content: space-between; align-items: center; padding: 6px 15px; margin: 2px auto; color: #fff; font-weight: bold; border-radius: 4px; font-size: 0.8rem; }
            .pyramid-level .count { font-size: 1.4em; }
            .level-lti {width: 19%;} .level-mdi {width: 26%;} .level-mti {width: 34%;} .level-fai {width: 41%;}
            .level-incidente {width: 49%;} .level-ato-inseguro {width: 56%;} .level-condicao-insegura {width: 64%;} .level-ato-positivo {width: 71%;}
            .level-lti, .level-mdi, .level-mti, .level-fai {background-color:#ef4444;}
            .level-incidente, .level-ato-inseguro {background-color:#f59e0b;}
            .level-condicao-insegura {background-color:#3b82f6;} .level-ato-positivo {background-color:#22c55e;}
            .table-container { background: #fff; border-radius: 10px; padding: 16px; color: #333; width: 100%; display: flex; flex-direction: column;}
            .table-container h5, .table-container h6 { color: #3182ce; margin-top:0; text-align:center; flex-shrink: 0; }
            .table-bi { width: 100%; border-collapse: collapse; }
            .table-bi th, .table-bi td { font-size: 14px; padding: 6px 8px; text-align: left; border-bottom: 1px solid #e2e8f0; }
            .table-bi th { color: #4a5568; }
            .top5-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; }
            #layout-metas-centro { grid-column: 1 / -1; background: #fff; border-radius: 10px; padding: 20px; color: #333; min-height: auto; }
            #meta-sub-filtro { display: flex; justify-content: center; gap: 10px; margin: 15px 0; }
            .meta-filtro-btn { background: #edf2f7; border: 1px solid #e2e8f0; color: #4a5568; padding: 8px 16px; border-radius: 20px; cursor: pointer; font-weight: bold; }
            .meta-filtro-btn.active { background: #3182ce; color: #fff; border-color: #3182ce; }
            .meta-item { margin-bottom: 15px; } .meta-label { display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 6px; }
            .meta-progress-bar { background-color: #e2e8f0; border-radius: 8px; height: 20px; overflow: hidden; }
            .meta-progress { background-color: #38a169; height: 100%; border-radius: 8px; }
            .lista-meta-container { max-height: 280px; overflow-y: auto; }
            .detalhe-item-meta { display: flex; justify-content: space-between; padding: 8px 4px; border-bottom: 1px solid #f7fafc; font-size: 14px; }
            .relatos-count { font-weight: bold; }
        </style>

        <div id="dashboard-app" class="dashboard-body">
            <nav id="sidebar">
                <div class="sidebar-header">
                    <img src="./logo.png" alt="Logo da Empresa" class="logo">
                    <h2 style="color: #e2e8f0;">Painel de Relatos</h2>
                </div>
                <h3>Setores</h3>
                <ul id="menu-setores" class="menu-list"></ul>
                <h3>Período</h3>
                <ul id="menu-mes-ano" class="menu-list"></ul>
            </nav>

            <main id="main-content">
                <div class="cards-resumo">
                    <div class="card"><h4>Funcionários no Filtro</h4><div id="total-funcionarios" class="valor">0</div></div>
                    <div class="card"><h4>Relatos no Filtro</h4><div id="total-relatos" class="valor">0</div></div>
                    <div class="card"><h4>Engajamento</h4><div id="taxa-engajamento" class="valor">0%</div></div>
                    <div class="card"><h4>Ato Inseguro Crítico</h4><div id="valor-ato-critico" class="valor" style="font-size: 16px;">N/A</div></div>
                </div>
                <div class="main-grid">
                    <div class="grid-item pyramid-container">
                        <h5 style="color: #3182ce; font-weight: 700;">PIRÂMIDE DE SEGURANÇA</h5>
                        <div class="pyramid-level level-lti"><span title="Lesão com Afastamento">LTI</span><span id="pyramid-count-lti" class="count">0</span></div>
                        <div class="pyramid-level level-mdi"><span title="Lesão com Dispensa Médica">MDI</span><span id="pyramid-count-mdi" class="count">0</span></div>
                        <div class="pyramid-level level-mti"><span title="Lesão com Tratamento Médico">MTI</span><span id="pyramid-count-mti" class="count">0</span></div>
                        <div class="pyramid-level level-fai"><span title="Lesão com Primeiros Socorros">FAI</span><span id="pyramid-count-fai" class="count">0</span></div>
                        <div class="pyramid-level level-incidente"><span>INCIDENTE</span><span id="pyramid-count-incidente" class="count">0</span></div>
                        <div class="pyramid-level level-ato-inseguro"><span>ATO INSEGURO</span><span id="pyramid-count-ato-inseguro" class="count">0</span></div>
                        <div class="pyramid-level level-condicao-insegura"><span>CONDIÇÃO INSEGURA</span><span id="pyramid-count-condicao-insegura" class="count">0</span></div>
                        <div class="pyramid-level level-ato-positivo"><span>ATO POSITIVO</span><span id="pyramid-count-ato-positivo" class="count">0</span></div>
                    </div>
                    <div class="grid-item"><h5>TOTAL DE RELATOS POR SETOR</h5><div class="chart-container"><canvas id="grafico-aderencia-colunas"></canvas></div></div>
                    <div class="grid-item"><h5>DISTRIBUIÇÃO DOS RELATOS</h5><div class="chart-container"><canvas id="grafico-tipo-relato"></canvas></div></div>

                    <div id="layout-padrao-centro" style="grid-column: 1 / -1; display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;">
                        <div class="grid-item"><h5>EVOLUÇÃO MENSAL</h5><div class="chart-container"><canvas id="grafico-evolucao-linha"></canvas></div></div>
                        <div class="table-container" style="flex: 1;"><h5>ÚLTIMOS RELATOS</h5><div class="detalhe-list-wrapper"><table id="tabela-detalhe-relatos-padrão" class="table-bi"><thead><tr><th>Data</th><th>Colaborador</th><th>Tipo</th></tr></thead><tbody></tbody></table></div></div>
                        <div class="table-container" style="flex: 1;"><h5>RANKING DE ENGAJAMENTO</h5><div class="detalhe-list-wrapper"><table id="tabela-ranking-padrão" class="table-bi"><thead><tr><th>#</th><th>Nome</th><th>Relatos</th></tr></thead><tbody></tbody></table></div></div>
                    </div>
                    
                    <div id="layout-metas-centro" style="display: none;">
                        <h5 id="meta-progresso-titulo"></h5>
                        <div class="meta-item">
                            <div id="meta-progresso-label" class="meta-label"></div>
                            <div class="meta-progress-bar"><div id="meta-progresso-barra" class="meta-progress"></div></div>
                        </div>
                        <div id="meta-sub-filtro">
                            <button class="meta-filtro-btn active" data-filtro="todos">Todos</button>
                            <button class="meta-filtro-btn" data-filtro="atingiu">Atingiram a Meta</button>
                            <button class="meta-filtro-btn" data-filtro="pendente">Pendentes</button>
                        </div>
                        <div class="lista-meta-container"><ul id="lista-funcionarios-meta" style="list-style:none; padding:0;"></ul></div>
                    </div>
                    
                    <div class="grid-item full-width">
                        <h5>TOP 5 OCORRÊNCIAS</h5>
                        <div class="top5-grid">
                            <div class="table-container"><h6>Condições Inseguras</h6><table id="tabela-top-tipoDaCondicaoInsegura" class="table-bi"><thead><tr><th>Ocorrência</th><th>Qtd</th></tr></thead><tbody></tbody></table></div>
                            <div class="table-container"><h6>Atos Inseguros</h6><table id="tabela-top-tipoDoAtoInseguro" class="table-bi"><thead><tr><th>Ocorrência</th><th>Qtd</th></tr></thead><tbody></tbody></table></div>
                            <div class="table-container"><h6>Acidentes</h6><table id="tabela-top-tipoDoAcidente" class="table-bi"><thead><tr><th>Ocorrência</th><th>Qtd</th></tr></thead><tbody></tbody></table></div>
                            <div class="table-container"><h6>Incidentes</h6><table id="tabela-top-tipoDoIncidente" class="table-bi"><thead><tr><th>Ocorrência</th><th>Qtd</th></tr></thead><tbody></tbody></table></div>
                            <div class="table-container"><h6>Relatos Positivos</h6><table id="tabela-top-tipoDoAtoPositivo" class="table-bi"><thead><tr><th>Ocorrência</th><th>Qtd</th></tr></thead><tbody></tbody></table></div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    `;}

    iniciarDashboard();
});
