/**
 * npm run reset — restore hunt:board to its initial state (and clear photo reviews
 * + advisor pings). Uses REDIS_URL if set, else the local .data file.
 * Against a deployed app you can also use the Reset button on /exec.
 */
import { resetBoard } from "../lib/board";

resetBoard()
  .then((b) => {
    console.log(`Reset ${process.env.REDIS_URL ? "redis" : "file store"}:`, JSON.stringify(b));
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
