import QRCodeLib from 'qrcode';
import { db } from './firebase-config.js';
import { collection, addDoc, onSnapshot, query, orderBy, limit, getDocs, deleteDoc, serverTimestamp, doc } from "firebase/firestore";

document.addEventListener('DOMContentLoaded', () => {
    const queueList = document.getElementById('queue-list');
    const historyList = document.getElementById('history-list');
    const addForm = document.getElementById('add-form');
    const nameInput = document.getElementById('name');
    const whatsappInput = document.getElementById('whatsapp');
    const lancheInput = document.getElementById('add-lanche');
    const bebidaInput = document.getElementById('add-bebida');
    const qrcodeContainer = document.getElementById('qrcode');
    const emptyQueueMessage = document.getElementById('empty-queue-message');
    const callNextBtn = document.getElementById('call-next-btn');

    // Elementos de estatísticas
    const statTotalAtendidos = document.getElementById('stat-total-atendidos');
    const statTopLanche = document.getElementById('stat-top-lanche');

    // Sounds
    const addSound = document.getElementById('add-sound');
    const callSound = document.getElementById('call-sound');
    const removeSound = document.getElementById('remove-sound');

    // Forçar volume máximo
    if (addSound) addSound.volume = 1.0;
    if (callSound) callSound.volume = 1.0;
    if (removeSound) removeSound.volume = 1.0;

    // ESTADO DO SOM (Ligar / Desligar através da barra no topo)
    let soundEnabled = false;
    const soundControlBar = document.getElementById('sound-control-bar');
    const soundIcon = document.getElementById('sound-icon');
    const soundText = document.getElementById('sound-text');

    // FUNÇÃO BLINDADA PARA ÁUDIO EM SEGUNDO PLANO
    function tocarAlarme(elementoAudio) {
        if (!elementoAudio) return;
        
        elementoAudio.pause();
        elementoAudio.currentTime = 0;
        
        // Um pequeno atraso (50ms) ajuda o navegador a processar o áudio caso a aba esteja escondida/minimizada
        setTimeout(() => {
            const playPromise = elementoAudio.play();
            if (playPromise !== undefined) {
                playPromise.catch(erro => {
                    console.warn("Navegador bloqueou o áudio dinâmico (aba escondida?). Recarregando...", erro);
                    elementoAudio.load(); 
                });
            }
        }, 50);
    }

    if (soundControlBar) {
        soundControlBar.addEventListener('click', () => {
            soundEnabled = !soundEnabled;

            if (soundEnabled) {
                // TOCA O SOM DE TESTE COMPLETO PARA OBTER PERMISSÃO TOTAL DO NAVEGADOR
                if (addSound) {
                    addSound.currentTime = 0;
                    addSound.play().catch(e => console.log("Erro no unlock de áudio:", e));
                }
                
                soundControlBar.style.background = '#d4edda';
                soundControlBar.style.color = '#155724';
                soundIcon.className = 'fas fa-volume-up';
                soundIcon.style.color = '#1cc88a';
                soundText.textContent = 'Alarme Sonoro Ativado (Som de Teste Reproduzido)';
            } else {
                soundControlBar.style.background = '#e4e6eb';
                soundControlBar.style.color = '#4b4f56';
                soundIcon.className = 'fas fa-volume-mute';
                soundIcon.style.color = '#e74a3b';
                soundText.textContent = 'Alarme Sonoro Desativado (Clique para Ativar)';
            }
        });
    }

    const queueCollection = collection(db, "queue");
    const historyCollection = collection(db, "history");

    // Variáveis de controle de paginação
    let currentPage = 1;
    const itemsPerPage = 10;
    let allPeople = []; // Guarda a fila inteira

    // Renderizar Fila de Espera com Paginação
    const renderQueue = (people) => {
        allPeople = people; // Atualiza a lista global com os dados do Firebase
        if (!queueList) return;
        
        queueList.innerHTML = '';
        const paginationControls = document.getElementById('pagination-controls');
        if (paginationControls) paginationControls.innerHTML = '';

        if (callNextBtn) callNextBtn.disabled = people.length === 0;

        if (people.length === 0) {
            if (emptyQueueMessage) emptyQueueMessage.style.display = 'block';
            return;
        } 
        
        if (emptyQueueMessage) emptyQueueMessage.style.display = 'none';

        // Lógica matemática da paginação
        const totalPages = Math.ceil(people.length / itemsPerPage);
        
        // Evita ficar preso numa página vazia caso apaguem os itens
        if (currentPage > totalPages) currentPage = totalPages || 1; 

        // Corta os itens exatos da página atual
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const paginatedPeople = people.slice(startIndex, endIndex);

        // Renderiza apenas os itens da página atual
        paginatedPeople.forEach((person, index) => {
            // Calcula o número real na fila, e não apenas o index da página
            const actualPosition = startIndex + index + 1; 
            
            const li = document.createElement('li');
            li.className = 'queue-item';
            li.dataset.id = person.id;

            li.innerHTML = `
                <div class="person-info" style="display: flex; align-items: center; width: 100%;">
                    <span class="person-position" style="font-size: 1.3rem; font-weight: 700; color: var(--primary); margin-right: 15px; min-width: 35px;">${actualPosition}º</span>
                    <div class="person-details" style="flex: 1;">
                        <div style="font-size: 1.1rem; font-weight: 700; color: var(--heading-color);">
                            ${person.name} <span style="font-size: 0.85rem; font-weight: 400; color: #666; margin-left: 10px;"><i class="fab fa-whatsapp" style="color: #25d366;"></i> ${person.whatsapp}</span>
                        </div>
                        <div style="background: #f1f3f9; border-left: 4px solid var(--primary); padding: 8px 12px; margin-top: 6px; border-radius: 6px; font-size: 0.95rem; color: #333;">
                            🍔 <strong>Pedido:</strong> <span style="color: var(--primary-dark); font-weight: 600;">${person.lanche || 'Não informado'}</span> + <span style="color: #555;">${person.bebida || 'Sem bebida'}</span>
                        </div>
                    </div>
                </div>
                <div class="actions" style="margin-left: 15px;">
                    <button class="btn-remove" title="Remover da Fila"><i class="fas fa-times-circle"></i></button>
                </div>
            `;
            queueList.appendChild(li);
        });

        // Constrói os botões HTML da paginação
        if (totalPages > 1 && paginationControls) {
            
            // Botão "Voltar"
            const btnPrev = document.createElement('button');
            btnPrev.className = 'page-btn';
            btnPrev.innerHTML = '<i class="fas fa-chevron-left"></i>';
            btnPrev.disabled = currentPage === 1;
            btnPrev.onclick = () => { currentPage--; renderQueue(allPeople); };
            paginationControls.appendChild(btnPrev);

            // Botões numéricos (1, 2, 3...)
            for (let i = 1; i <= totalPages; i++) {
                const btnPage = document.createElement('button');
                btnPage.className = `page-btn ${i === currentPage ? 'active' : ''}`;
                btnPage.textContent = i;
                btnPage.onclick = () => { currentPage = i; renderQueue(allPeople); };
                paginationControls.appendChild(btnPage);
            }

            // Botão "Avançar"
            const btnNext = document.createElement('button');
            btnNext.className = 'page-btn';
            btnNext.innerHTML = '<i class="fas fa-chevron-right"></i>';
            btnNext.disabled = currentPage === totalPages;
            btnNext.onclick = () => { currentPage++; renderQueue(allPeople); };
            paginationControls.appendChild(btnNext);
        }
    };

    // Renderizar Histórico e Atualizar Estatísticas
    const renderHistory = (historyDocs) => {
        if (!historyList) return;
        historyList.innerHTML = '';

        if (statTotalAtendidos) {
            statTotalAtendidos.textContent = historyDocs.length;
        }

        if (historyDocs.length > 0 && statTopLanche) {
            const lanchesCount = {};
            historyDocs.forEach(item => {
                const l = item.lanche || 'Desconhecido';
                lanchesCount[l] = (lanchesCount[l] || 0) + 1;
            });
            let top = Object.keys(lanchesCount)[0];
            let max = lanchesCount[top];
            for (let l in lanchesCount) {
                if (lanchesCount[l] > max) {
                    max = lanchesCount[l];
                    top = l;
                }
            }
            statTopLanche.textContent = top;
        } else if (statTopLanche) {
            statTopLanche.textContent = '--';
        }

        if (historyDocs.length === 0) {
            historyList.innerHTML = `
                <li style="justify-content: center; color: #858796; padding: 25px; border-left: none;">
                    Nenhum pedido concluído recentemente nesta sessão.
                </li>
            `;
        } else {
            historyDocs.forEach(item => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <div style="width: 100%;">
                        <div style="font-weight: 700; font-size: 1.05rem; color: var(--heading-color);">
                            ${item.name} <span style="font-weight: 400; font-size: 0.85rem; color: #666; margin-left: 10px;"><i class="fab fa-whatsapp"></i> ${item.whatsapp}</span>
                        </div>
                        <div style="background: #f8f9fc; border-left: 4px solid var(--success); padding: 6px 10px; margin-top: 5px; border-radius: 4px; font-size: 0.9rem;">
                            ✅ <strong>Entregue:</strong> <span style="font-weight: 600; color: #2e384d;">${item.lanche || 'Lanche'} + ${item.bebida || ''}</span>
                        </div>
                    </div>
                `;
                historyList.appendChild(li);
            });
        }
    };

    // ESCUTA EM TEMPO REAL DO FIREBASE
    let isInitialLoad = true;
    const qQueue = query(queueCollection, orderBy("timestamp", "asc"));
    
    onSnapshot(qQueue, (snapshot) => {
        if (!isInitialLoad && soundEnabled) {
            let hasNewAdded = false;
            
            snapshot.docChanges().forEach((change) => {
                if (change.type === "added") {
                    hasNewAdded = true;
                }
            });

            // Dispara o alarme usando a nova função com setTimeout
            if (hasNewAdded && addSound) {
                tocarAlarme(addSound);
            }
        }

        const people = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderQueue(people);
        
        isInitialLoad = false;
    });

    const qHistory = query(historyCollection, limit(20));
    onSnapshot(qHistory, (snapshot) => {
        const history = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderHistory(history);
    });

    // Adicionar Manualmente pelo Painel
    const addPerson = async (name, whatsapp, lanche, bebida) => {
        if (name && whatsapp) {
            try {
                await addDoc(queueCollection, {
                    name: name,
                    whatsapp: whatsapp,
                    lanche: lanche || 'X-Burger',
                    bebida: bebida || 'Sem bebida',
                    timestamp: serverTimestamp()
                });
            } catch (error) {
                console.error("Erro ao adicionar:", error);
                alert("Ocorreu um erro ao adicionar à fila.");
            }
        }
    };

    if (addForm) {
        addForm.addEventListener('submit', (e) => {
            e.preventDefault();
            addPerson(
                nameInput.value.trim(), 
                whatsappInput.value.trim(), 
                lancheInput ? lancheInput.value : 'X-Burger', 
                bebidaInput ? bebidaInput.value : 'Sem bebida'
            );
            addForm.reset();
        });
    }

    // Remover da Fila
    if (queueList) {
        queueList.addEventListener('click', (e) => {
            const removeButton = e.target.closest('.btn-remove');
            if (removeButton) {
                const li = e.target.closest('.queue-item');
                const personId = li.dataset.id;
                if (confirm("Tem certeza que deseja remover este pedido da lista?")) {
                    deleteDoc(doc(db, "queue", personId)).then(() => {
                        if (removeSound) removeSound.play().catch(e => console.log("Áudio bloqueado:", e));
                    }).catch(error => {
                        console.error("Erro ao remover:", error);
                    });
                }
            }
        });
    }

    // Chamar Próximo (Envia WhatsApp e move para o Histórico)
    if (callNextBtn) {
        callNextBtn.addEventListener('click', async () => {
            const asArray = Array.from(queueList.children);
            if (asArray.length === 0) {
                alert("A fila está vazia.");
                return;
            }

            const firstInQueueQuery = query(queueCollection, orderBy("timestamp", "asc"), limit(1));
            const snapshot = await getDocs(firstInQueueQuery);

            if (!snapshot.empty) {
                const nextPersonDoc = snapshot.docs[0];
                const person = { id: nextPersonDoc.id, ...nextPersonDoc.data() };
                
                const numeroLimpo = person.whatsapp.replace(/\D/g, '');
                const lancheDesc = person.lanche || 'Lanche';
                const bebidaDesc = person.bebida || '';
                const mensagem = `Olá ${person.name}, o seu pedido (${lancheDesc} + ${bebidaDesc}) na Lancheria está pronto! Por favor, dirija-se ao balcão para retirada. Bom apetite! 🍔🥤`;
                
                const whatsappUrl = `https://wa.me/${numeroLimpo}?text=${encodeURIComponent(mensagem)}`;
                
                window.open(whatsappUrl, '_blank');
                if (callSound) callSound.play().catch(e => console.log("Áudio bloqueado:", e));

                const listItem = queueList.querySelector(`[data-id="${person.id}"]`);
                if(listItem) {
                    listItem.classList.add('calling');
                }

                setTimeout(async () => {
                    try {
                        await addDoc(historyCollection, {
                            name: person.name,
                            whatsapp: person.whatsapp,
                            lanche: person.lanche || 'Lanche',
                            bebida: person.bebida || '',
                            timestamp: serverTimestamp()
                        });
                        await deleteDoc(doc(db, "queue", person.id));
                    } catch (error) {
                        console.error("Erro ao mover para o histórico:", error);
                    }
                }, 2000);
            }
        });
    }

    // Gerar QR Code
    const generateQRCode = () => {
        if (!qrcodeContainer) return;
        const currentUrl = window.location.href.split('?')[0];
        const joinUrl = currentUrl.replace('index.html', '').replace(/\/$/, '') + '/join.html';
        
        QRCodeLib.toCanvas(document.createElement('canvas'), joinUrl, { width: 256, errorCorrectionLevel: 'H' }, (err, canvas) => {
            if (err) throw err;
            qrcodeContainer.innerHTML = '';
            qrcodeContainer.appendChild(canvas);
        });
    };

    generateQRCode();
});