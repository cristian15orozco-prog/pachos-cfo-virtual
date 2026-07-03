import { app } from "./app";
import { env } from "./config/env";
import { scheduleDailySync } from "./jobs/dailySync";

app.listen(env.port, () => {
  console.log(`CFO Virtual Pachos Supermarket backend escuchando en puerto ${env.port}`);
  scheduleDailySync();
});
