import { Router } from 'express';
import {
  getAllTrashItems,
  getTrashItemById,
  createTrashItem,
  updateTrashItem,
  updateFillLevelChangesCore, 
  addMultipleTrashItems,
} from '../controllers/trashbin';
import { authenticateToken } from '../middleware/authenticate';
const router = Router();

// Get a trash item by ID
router.get('/:id', authenticateToken, getTrashItemById);

// Get all trash items
router.get('/', authenticateToken, getAllTrashItems);

// Create a new trash item
router.post('/', authenticateToken, createTrashItem);

// TODO: We dont need this route. The logic of updateFillLevelChangesCore should be part of updating the project...
router.put('/updateFillLevelChanges', updateFillLevelChangesCore);

router.patch('/:id', authenticateToken, updateTrashItem);

router.post('/script', authenticateToken, addMultipleTrashItems);

export default router;
