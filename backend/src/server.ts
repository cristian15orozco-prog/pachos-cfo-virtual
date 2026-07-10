import { app } from "./app";
import { env } from "./config/env";
import { scheduleDailySync } from "./jobs/dailySync";

// Red de seguridad: si algún error se escapa de asyncHandler, esto evita que
// el proceso se caiga por completo (comportamiento por defecto de Node ante
// un unhandled rejection). La petición específica puede quedar colgada, pero
// el servidor sigue en pie para el resto de usuarios.
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});

app.listen(env.port, () => {
  console.log(`CFO Virtual Pachos Supermarket backend escuchando en puerto ${env.port}`);
  scheduleDailySync();
});
