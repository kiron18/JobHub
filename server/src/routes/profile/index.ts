import { Router } from 'express';
import profileCoreRouter from './profile-core';
import experienceRouter from './experience';
import educationRouter from './education';
import achievementsRouter from './achievements';
import jobsRouter from './jobs';
import identityRouter from './identity';

const router = Router();

router.use(profileCoreRouter);
router.use(experienceRouter);
router.use(educationRouter);
router.use(achievementsRouter);
router.use(jobsRouter);
router.use(identityRouter);

export default router;
