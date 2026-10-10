ALTER TABLE `User`
ADD COLUMN `onboardingCompleted` BOOLEAN NOT NULL DEFAULT false;

UPDATE `User` AS u
SET u.`onboardingCompleted` = true
WHERE (
    SELECT COUNT(DISTINCT a.`questionId`)
    FROM `OnboardingAnswer` AS a
    WHERE a.`userId` = u.`id`
      AND a.`questionId` IN (
        'gender',
        'profession',
        'age_range',
        'prayer',
        'sect',
        'marriage_timeline',
        'cultural_background',
        'children',
        'values',
        'family_involvement',
        'cultural_compatibility',
        'intercultural_marriage',
        'children_values',
        'location_pref'
      )
) = 14
AND EXISTS (
    SELECT 1
    FROM `OnboardingAnswer` AS gender_answer
    INNER JOIN `Profile` AS p ON p.`userId` = u.`id`
    WHERE gender_answer.`userId` = u.`id`
      AND (
        (p.`gender` = 'female' AND gender_answer.`questionId` = 'hijab')
        OR (p.`gender` = 'male' AND gender_answer.`questionId` = 'beard')
      )
);
