// La boucle de dépilage arrivera avec le premier type de tâche (ingestion).
// D'ici là, le processus reste vivant pour que Compose ne le relance pas en boucle.
console.log("worker démarré");
setInterval(() => {}, 1 << 30);
