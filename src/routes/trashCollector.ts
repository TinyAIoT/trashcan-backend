import { Router } from 'express';
import {
  createTrashCollector,
  getTrashCollector,
  assignTrashbinsToTrashCollector,
  getTrashbinsAssignedToTrashCollector,
  testHistory,
} from '../controllers/trashCollector';
import { authenticateToken } from '../middleware/authenticate';
const router = Router();

router.post('/', authenticateToken, createTrashCollector);

router.get('/', authenticateToken, getTrashCollector);

router.post('/assign', authenticateToken, assignTrashbinsToTrashCollector);

router.get(
  '/:trashCollectorId/trashbins',
  authenticateToken,
  getTrashbinsAssignedToTrashCollector
);

router.get('/history', testHistory);

export default router;
