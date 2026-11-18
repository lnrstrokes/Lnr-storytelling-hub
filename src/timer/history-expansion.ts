/* ============================================================
   lnr Studio — World History Expansion Bank (190 unique questions)
   Zero overlap with PRIVATE_BANKS.history (322) or demo-content.
   Tuple format:
     [question, [optA, optB, optC, optD], correctIdx, reference, insight, difficulty]
   ============================================================ */

export type HistoryTuple = [
  string,
  [string, string, string, string],
  number,
  string,
  string,
  'Easy' | 'Medium' | 'Hard'
];

export const HISTORY_EXPANSION: HistoryTuple[] = [
  [
    'Which Indus Valley city was famous for its grid streets and brick drainage system?',
    ['Taxila', 'Mohenjo-daro', 'Pataliputra', 'Mathura'],
    1,
    'c. 2500 BCE',
    'Mohenjo-daro featured covered brick sewers, a Great Bath, and standardized baked bricks.',
    'Medium'
  ],
  [
    'Which ancient Chinese dynasty produced the earliest known oracle bone inscriptions?',
    ['Xia Dynasty', 'Shang Dynasty', 'Qin Dynasty', 'Han Dynasty'],
    1,
    'c. 1250 BCE',
    'Diviners carved questions onto ox bones and turtle shells that later revealed early Chinese script.',
    'Medium'
  ],
  [
    'Which Mesoamerican civilization carved colossal basalt stone heads?',
    ['Olmec', 'Zapotec', 'Toltec', 'Maya'],
    0,
    'c. 1200–400 BCE',
    'Found along the Gulf Coast of Mexico, Olmec heads weighed up to twenty tons each.',
    'Medium'
  ],
  [
    'Which ancient Nubian kingdom conquered and ruled Egypt as its Twenty-fifth Dynasty?',
    ['Aksum', 'Kush', 'Carthage', 'Saba'],
    1,
    'c. 747–656 BCE',
    'Kings from Napata such as Piye and Taharqa ruled both Nubia and Egypt.',
    'Hard'
  ],
  [
    'Which Greek mathematician wrote the geometry treatise known as The Elements?',
    ['Archimedes', 'Pythagoras', 'Euclid', 'Eratosthenes'],
    2,
    'Alexandria, c. 300 BCE',
    'Euclid organized geometric proofs from a small set of axioms that taught mathematics for two millennia.',
    'Easy'
  ],
  [
    'Which ancient Greek scholar calculated the circumference of the Earth using shadows?',
    ['Thales', 'Aristarchus', 'Eratosthenes', 'Hipparchus'],
    2,
    'c. 240 BCE',
    'Comparing noon shadows in Syene and Alexandria, Eratosthenes came remarkably close to the true size.',
    'Medium'
  ],
  [
    'Who founded the Maurya Empire in northern India around 321 BCE?',
    ['Ashoka', 'Chandragupta Maurya', 'Samudragupta', 'Harsha'],
    1,
    'c. 321 BCE',
    'Chandragupta united much of the Indian subcontinent with the counsel of Kautilya.',
    'Medium'
  ],
  [
    'Which Mauryan ruler erected stone pillars promoting non-violence after the Kalinga War?',
    ['Bindusara', 'Ashoka', 'Kanishka', 'Chandragupta II'],
    1,
    'c. 260 BCE',
    'Ashoka carved his edicts in Prakrit, Greek, and Aramaic across his vast empire.',
    'Easy'
  ],
  [
    'Which Chinese emperor standardized weights, currency, and script after unifying China?',
    ['Emperor Wu of Han', 'Qin Shi Huang', 'Emperor Taizong', 'Kublai Khan'],
    1,
    '221 BCE',
    'Qin Shi Huang also commissioned the vast Terracotta Army near Xi’an.',
    'Easy'
  ],
  [
    'Which dynasty opened the Silk Road westward under Emperor Wu?',
    ['Zhou Dynasty', 'Qin Dynasty', 'Han Dynasty', 'Sui Dynasty'],
    2,
    'c. 138 BCE',
    'Envoy Zhang Qian’s journeys to Central Asia linked Han China with Parthia and the Mediterranean.',
    'Medium'
  ],
  [
    'Which Roman poet authored the epic Aeneid?',
    ['Ovid', 'Horace', 'Virgil', 'Juvenal'],
    2,
    '19 BCE',
    'Commissioned in the age of Augustus, the Aeneid traced Rome’s mythical roots to Troy.',
    'Easy'
  ],
  [
    'In which year did the Roman Empire split permanently into Western and Eastern halves?',
    ['313 CE', '395 CE', '410 CE', '476 CE'],
    1,
    'Death of Theodosius I, 395 CE',
    'After Theodosius I died, his sons Honorius and Arcadius ruled the West and East separately.',
    'Hard'
  ],
  [
    'Which East African trading kingdom adopted Christianity in the fourth century CE under King Ezana?',
    ['Aksum', 'Songhai', 'Kilwa', 'Kanem'],
    0,
    'c. 330 CE',
    'Aksum controlled Red Sea commerce between Rome and India and minted its own gold coins.',
    'Medium'
  ],
  [
    'Which Mesoamerican metropolis was home to the Pyramid of the Sun and Pyramid of the Moon?',
    ['Palenque', 'Teotihuacan', 'Tikal', 'Chichen Itza'],
    1,
    'c. 200 CE',
    'At its height, Teotihuacan in central Mexico was one of the largest cities in the world.',
    'Medium'
  ],
  [
    'Which Indian dynasty of the fourth to sixth centuries CE is noted for advances in algebra and zero?',
    ['Chola Dynasty', 'Gupta Empire', 'Mughal Empire', 'Pallava Dynasty'],
    1,
    'c. 320–550 CE',
    'Astronomers like Aryabhata worked during the Gupta era, often called India’s classical golden age.',
    'Medium'
  ],
  [
    'Which Byzantine general reconquered North Africa and Italy for Emperor Justinian?',
    ['Heraclius', 'Belisarius', 'Narses', 'Basil II'],
    1,
    '533–554 CE',
    'Belisarius defeated both the Vandals in Carthage and the Ostrogoths in Italy.',
    'Hard'
  ],
  [
    'Which monumental domed church was completed in Constantinople in 537 CE?',
    ['St. Mark’s Basilica', 'Hagia Sophia', 'Church of the Holy Sepulchre', 'San Vitale'],
    1,
    '537 CE',
    'Designed by mathematicians Anthemius of Tralles and Isidore of Miletus for Justinian I.',
    'Easy'
  ],
  [
    'Which short-lived Chinese dynasty built the Grand Canal linking the Yellow and Yangtze rivers?',
    ['Sui Dynasty', 'Tang Dynasty', 'Song Dynasty', 'Ming Dynasty'],
    0,
    '581–618 CE',
    'The Sui Grand Canal enabled grain shipments from the fertile south to supply northern capitals.',
    'Hard'
  ],
  [
    'Which female ruler became the only woman to reign in her own right as Emperor of China?',
    ['Empress Dowager Cixi', 'Wu Zetian', 'Empress Lu', 'Princess Taiping'],
    1,
    '690–705 CE',
    'Wu Zetian promoted civil service examinations and expanded Tang influence in Central Asia.',
    'Medium'
  ],
  [
    'Which Battle of 751 CE near the Talas River brought Chinese papermakers into the Abbasid world?',
    ['Battle of Tours', 'Battle of Talas', 'Battle of Manzikert', 'Battle of Yarmouk'],
    1,
    '751 CE',
    'Papermaking spread rapidly from Samarkand to Baghdad, Damascus, and eventually Europe.',
    'Hard'
  ],
  [
    'Which Abbasid caliph founded the round city of Baghdad in 762 CE?',
    ['Harun al-Rashid', 'Al-Mansur', 'Al-Ma’mun', 'Mu’awiya'],
    1,
    '762 CE',
    'Baghdad’s circular plan placed the palace and mosque at its geometric center near the Tigris.',
    'Hard'
  ],
  [
    'What was the famous translation and research center in ninth-century Abbasid Baghdad called?',
    ['Al-Azhar', 'House of Wisdom', 'Sankore Madrasa', 'Ulugh Beg Observatory'],
    1,
    'Bayt al-Hikma, 9th c.',
    'Scholars preserved and expanded Greek, Persian, and Indian works on medicine, optics, and astronomy.',
    'Easy'
  ],
  [
    'Which Persian polymath wrote The Canon of Medicine, used in European universities for centuries?',
    ['Al-Khwarizmi', 'Ibn Sina (Avicenna)', 'Al-Razi', 'Ibn Khaldun'],
    1,
    '1025 CE',
    'Ibn Sina’s five-volume encyclopedia systematically cataloged diseases, anatomy, and pharmacology.',
    'Medium'
  ],
  [
    'Which ninth-century scholar’s treatise on equations gave us the word "algebra"?',
    ['Omar Khayyam', 'Al-Khwarizmi', 'Al-Biruni', 'Ibn al-Haytham'],
    1,
    'c. 820 CE',
    'The Arabic word "al-jabr" comes from the title of Muhammad ibn Musa al-Khwarizmi’s book.',
    'Medium'
  ],
  [
    'Which Norse explorer led the first known European expedition to settle briefly in North America?',
    ['Erik the Red', 'Leif Erikson', 'Harald Hardrada', 'Rollo'],
    1,
    'c. 1000 CE',
    'Archaeologists confirmed a Norse settlement at L’Anse aux Meadows in Newfoundland.',
    'Easy'
  ],
  [
    'Which Japanese court noblewoman wrote The Tale of Genji around the year 1000 CE?',
    ['Sei Shonagon', 'Murasaki Shikibu', 'Ono no Komachi', 'Izumi Shikibu'],
    1,
    'Heian Period, c. 1008 CE',
    'Widely regarded as the world’s earliest full-length novel, depicting court life in Heian-kyo.',
    'Medium'
  ],
  [
    'Which maritime South Indian dynasty sent naval expeditions across the Bay of Bengal to Srivijaya?',
    ['Pala Empire', 'Chola Dynasty', 'Rashtrakuta Dynasty', 'Maratha Empire'],
    1,
    '11th century CE',
    'Under Rajendra I, Chola fleets projected power across Sri Lanka and Southeast Asia.',
    'Hard'
  ],
  [
    'Which 1071 battle saw Seljuk Turks defeat the Byzantine Empire and open Anatolia to Turkish settlement?',
    ['Battle of Hattin', 'Battle of Manzikert', 'Battle of Lepanto', 'Battle of Mohacs'],
    1,
    'August 1071',
    'Byzantine Emperor Romanos IV was captured during the battle in eastern Anatolia.',
    'Hard'
  ],
  [
    'Which Khmer king commissioned the massive temple complex of Angkor Wat in the 12th century?',
    ['Jayavarman VII', 'Suryavarman II', 'Indravarman I', 'Yasovarman I'],
    1,
    'c. 1113–1150 CE',
    'Angkor Wat remains the largest religious monument by land area ever constructed.',
    'Medium'
  ],
  [
    'Which English charter of 1215 forced King John to accept limits on royal taxation and arbitrary arrest?',
    ['Bill of Rights', 'Magna Carta', 'Provisions of Oxford', 'Petition of Right'],
    1,
    'Runnymede, June 1215',
    'Magna Carta established the enduring principle that even the monarch is subject to the law.',
    'Easy'
  ],
  [
    'Which city was the capital of the Southern Song Dynasty and boasted over a million residents?',
    ['Kaifeng', 'Hangzhou', 'Nanjing', 'Guangzhou'],
    1,
    '1127–1279 CE',
    'Marco Polo marveled at Hangzhou’s canals, bridges, and thriving paper-money markets.',
    'Hard'
  ],
  [
    'Which Mongol ruler founded the Yuan Dynasty and made Khanbaliq (modern Beijing) his capital?',
    ['Genghis Khan', 'Ogedei Khan', 'Kublai Khan', 'Hulagu Khan'],
    2,
    '1271 CE',
    'Kublai Khan unified China under Mongol rule and hosted foreign travelers and merchants.',
    'Easy'
  ],
  [
    'Which Moroccan traveler dictated the Rihla after journeying some 75,000 miles across Africa and Eurasia?',
    ['Al-Idrisi', 'Ibn Battuta', 'Leo Africanus', 'Ibn Jubayr'],
    1,
    '1325–1354 CE',
    'Ibn Battuta visited Mali, Constantinople, Delhi, and Quanzhou over nearly thirty years.',
    'Easy'
  ],
  [
    'Which stone-walled kingdom in southern Africa traded gold through the Swahili Coast port of Sofala?',
    ['Great Zimbabwe', 'Kingdom of Kongo', 'Kanem-Bornu', 'Kingdom of Benin'],
    0,
    '11th–15th century CE',
    'Its dry-stone granite enclosures were built without mortar.',
    'Medium'
  ],
  [
    'Which Swahili Coast city-state minted its own copper coins and impressed Ibn Battuta in 1331?',
    ['Kilwa Kisiwani', 'Timbuktu', 'Zeila', 'Gondar'],
    0,
    '14th century CE',
    'Kilwa flourished on monsoon trade connecting gold from Zimbabwe with Indian Ocean textiles and porcelain.',
    'Hard'
  ],
  [
    'Which Aztec capital was built on an island in Lake Texcoco in 1325?',
    ['Teotihuacan', 'Tenochtitlan', 'Tula', 'Cuzco'],
    1,
    'Founded 1325 CE',
    'Causeways and floating chinampa gardens sustained hundreds of thousands of residents.',
    'Easy'
  ],
  [
    'Which West African empire succeeded Mali and reached its peak under Askia Muhammad?',
    ['Ghana Empire', 'Songhai Empire', 'Oyo Empire', 'Asante Empire'],
    1,
    'c. 1493–1528 CE',
    'Askia Muhammad standardized weights and promoted Islamic scholarship in Timbuktu and Gao.',
    'Medium'
  ],
  [
    'Which Central Asian conqueror made Samarkand his dazzling capital in the late 14th century?',
    ['Babur', 'Timur (Tamerlane)', 'Nader Shah', 'Mahmud of Ghazni'],
    1,
    '1370–1405 CE',
    'Timur spared artisans from conquered cities and sent them to adorn Samarkand with turquoise domes.',
    'Medium'
  ],
  [
    'Which Korean monarch oversaw the creation of the phonetic Hangul alphabet in 1443?',
    ['King Taejo', 'King Sejong the Great', 'Yi Sun-sin', 'Emperor Gojong'],
    1,
    'Joseon Dynasty, 1443',
    'Hangul was designed so ordinary people could learn to read and write quickly without thousands of characters.',
    'Medium'
  ],
  [
    'In which year did Ottoman Sultan Mehmed II capture Constantinople?',
    ['1389', '1453', '1492', '1526'],
    1,
    'May 29, 1453',
    'Massive bronze cannons breached the ancient Theodosian Walls, ending the Byzantine Empire.',
    'Easy'
  ],
  [
    'Which Portuguese prince sponsored early Atlantic voyages along the West African coast?',
    ['Vasco da Gama', 'Prince Henry the Navigator', 'Bartolomeu Dias', 'Ferdinand Magellan'],
    1,
    'Sagres, c. 1418–1460',
    'Portuguese caravels used triangular lateen sails to tack against coastal winds.',
    'Easy'
  ],
  [
    'Which explorer led the first Portuguese fleet to reach India by sailing around Africa in 1498?',
    ['Bartolomeu Dias', 'Vasco da Gama', 'Pedro Alvares Cabral', 'Amerigo Vespucci'],
    1,
    'Calicut, May 1498',
    'The Cape route connected Lisbon directly with the Malabar spice trade.',
    'Easy'
  ],
  [
    'Which 1494 treaty drew a meridian dividing newly claimed lands outside Europe between Spain and Portugal?',
    ['Treaty of Westphalia', 'Treaty of Tordesillas', 'Treaty of Utrecht', 'Treaty of Paris'],
    1,
    'June 1494',
    'Brokered with papal backing, the line left eastern Brazil inside Portugal’s sphere.',
    'Medium'
  ],
  [
    'Which Italian political thinker wrote The Prince in 1513?',
    ['Baldassare Castiglione', 'Niccolo Machiavelli', 'Francesco Guicciardini', 'Erasmus'],
    1,
    'Florence, 1513',
    'Machiavelli analyzed how rulers actually seize and keep political power in fractured Renaissance Italy.',
    'Easy'
  ],
  [
    'Which Dutch humanist published In Praise of Folly and edited a critical Greek New Testament?',
    ['Thomas More', 'Desiderius Erasmus', 'Michel de Montaigne', 'Francis Bacon'],
    1,
    '1511 / 1516',
    'Erasmus used satire to critique corruption in both church and court.',
    'Medium'
  ],
  [
    'In which year did Martin Luther post his Ninety-Five Theses in Wittenberg?',
    ['1492', '1517', '1534', '1555'],
    1,
    'October 31, 1517',
    'Printed copies spread across Germany within weeks, igniting the Protestant Reformation.',
    'Easy'
  ],
  [
    'Who led the expedition whose surviving ship Victoria completed the first circumnavigation in 1522?',
    ['Ferdinand Magellan & Juan Sebastian Elcano', 'Francis Drake', 'Vasco Nunez de Balboa', 'Hernan Cortes'],
    0,
    '1519–1522',
    'Magellan was killed in the Philippines, and Elcano piloted the last vessel back to Seville.',
    'Medium'
  ],
  [
    'Which Central Asian prince founded the Mughal Empire in India after the Battle of Panipat in 1526?',
    ['Akbar', 'Babur', 'Humayun', 'Aurangzeb'],
    1,
    'April 1526',
    'Babur used matchlock firearms and field artillery to defeat Ibrahim Lodi.',
    'Medium'
  ],
  [
    'Which Mughal emperor created a centralized tax system and held interfaith debates at Fatehpur Sikri?',
    ['Jahangir', 'Akbar the Great', 'Shah Jahan', 'Aurangzeb'],
    1,
    '1556–1605',
    'Akbar abolished the jizya tax on non-Muslims and patronized Persian and Sanskrit translations.',
    'Medium'
  ],
  [
    'Which Polish astronomer published On the Revolutions of the Heavenly Spheres in 1543?',
    ['Tycho Brahe', 'Johannes Kepler', 'Nicolaus Copernicus', 'Galileo Galilei'],
    2,
    '1543',
    'Copernicus placed the Sun rather than the Earth at the center of the planetary system.',
    'Easy'
  ],
  [
    'Which 1555 settlement allowed German princes to choose Lutheranism or Catholicism for their territories?',
    ['Peace of Augsburg', 'Edict of Nantes', 'Peace of Westphalia', 'Diet of Worms'],
    0,
    'September 1555',
    'Its principle "cuius regio, eius religio" temporarily eased religious war in the Holy Roman Empire.',
    'Hard'
  ],
  [
    'Which West African kingdom’s artisans cast intricate brass plaques depicting court life at Edo?',
    ['Kingdom of Benin', 'Kingdom of Kongo', 'Asante Empire', 'Dahomey'],
    0,
    '16th–17th century',
    'The Benin Bronzes decorated the royal palace of the Oba with extraordinary lost-wax craftsmanship.',
    'Medium'
  ],
  [
    'Which Korean admiral used armored "turtle ships" to defeat Japanese invasion fleets in the 1590s?',
    ['Sejong', 'Yi Sun-sin', 'Gwanggaeto', 'Kim Yu-sin'],
    1,
    'Imjin War, 1592–1598',
    'Admiral Yi Sun-sin never lost a naval battle despite being heavily outnumbered.',
    'Medium'
  ],
  [
    'Which 1598 French royal decree granted substantial religious toleration to Protestant Huguenots?',
    ['Treaty of Verdun', 'Edict of Nantes', 'Code Napoleon', 'Declaration of St. Germain'],
    1,
    'April 1598',
    'Issued by King Henry IV, it ended decades of French Wars of Religion until its revocation in 1685.',
    'Medium'
  ],
  [
    'Which chartered company, founded in 1602, became the first corporation to issue publicly traded stock?',
    ['British East India Company', 'Dutch East India Company (VOC)', 'Hudson’s Bay Company', 'Muscovy Company'],
    1,
    'Amsterdam, 1602',
    'The VOC held quasi-sovereign powers to sign treaties, mint coins, and maintain forts across Asia.',
    'Medium'
  ],
  [
    'Which English physician published On the Motion of the Heart and Blood in 1628?',
    ['Andreas Vesalius', 'William Harvey', 'Robert Boyle', 'Antonie van Leeuwenhoek'],
    1,
    '1628',
    'Harvey demonstrated experimentally that the heart pumps blood in a closed circular loop.',
    'Medium'
  ],
  [
    'Which 1648 treaties ended the Thirty Years’ War and shaped modern state sovereignty in Europe?',
    ['Treaties of Utrecht', 'Peace of Westphalia', 'Congress of Vienna', 'Peace of Lodi'],
    1,
    'October 1648',
    'Westphalia also recognized Dutch and Swiss independence from the Habsburg Empire.',
    'Medium'
  ],
  [
    'Which Mughal monument in Agra was commissioned by Shah Jahan in 1632?',
    ['Red Fort', 'Taj Mahal', 'Humayun’s Tomb', 'Qutb Minar'],
    1,
    'Completed c. 1648',
    'Built of white Makrana marble inlaid with semiprecious stones as a mausoleum for Mumtaz Mahal.',
    'Easy'
  ],
  [
    'Which English scientist published Principia Mathematica in 1687, uniting gravity and motion?',
    ['Robert Hooke', 'Isaac Newton', 'Edmond Halley', 'Michael Faraday'],
    1,
    'July 1687',
    'Newton’s laws explained both falling apples and elliptical planetary orbits.',
    'Easy'
  ],
  [
    'Which Dutch lensmaker first observed single-celled microorganisms through simple microscopes?',
    ['Robert Hooke', 'Antonie van Leeuwenhoek', 'Christiaan Huygens', 'Zacharias Janssen'],
    1,
    '1670s',
    'He wrote to London’s Royal Society describing "animalcules" swimming in rainwater.',
    'Medium'
  ],
  [
    'Which 1688 event brought William and Mary to the English throne and produced the English Bill of Rights?',
    ['English Civil War', 'Glorious Revolution', 'Chartist Movement', 'Jacobite Rising'],
    1,
    '1688–1689',
    'Parliament secured regular sessions and control over taxation without bloodshed in England.',
    'Medium'
  ],
  [
    'Which Russian tsar built St. Petersburg on the Baltic coast as a "window to the West"?',
    ['Ivan the Terrible', 'Peter the Great', 'Catherine the Great', 'Alexander I'],
    1,
    'Founded 1703',
    'Peter modernized Russia’s navy, civil service, and calendar during his reign.',
    'Easy'
  ],
  [
    'Which 1759 battle gave Britain decisive control over Quebec and New France?',
    ['Battle of Saratoga', 'Battle of the Plains of Abraham', 'Battle of Louisbourg', 'Battle of Ticonderoga'],
    1,
    'Seven Years’ War, 1759',
    'Both commanders—James Wolfe and the Marquis de Montcalm—were mortally wounded in the fighting.',
    'Hard'
  ],
  [
    'Which Scottish economist published The Wealth of Nations in 1776?',
    ['David Hume', 'Adam Smith', 'Thomas Malthus', 'John Stuart Mill'],
    1,
    'March 1776',
    'Smith analyzed division of labor and how market prices coordinate production.',
    'Easy'
  ],
  [
    'Which French thinker argued for the separation of executive, legislative, and judicial powers?',
    ['Voltaire', 'Montesquieu', 'Jean-Jacques Rousseau', 'Denis Diderot'],
    1,
    'The Spirit of the Laws, 1748',
    'Montesquieu’s framework deeply influenced the drafting of the United States Constitution.',
    'Medium'
  ],
  [
    'Which engineer dramatically improved the Newcomen steam engine with a separate condenser in the 1760s?',
    ['George Stephenson', 'James Watt', 'Richard Trevithick', 'Thomas Savery'],
    1,
    'Patent 1769',
    'Watt’s design cut coal consumption sharply and powered factories, mines, and mills.',
    'Easy'
  ],
  [
    'Which 1781 siege effectively ended major combat in the American Revolutionary War?',
    ['Battle of Bunker Hill', 'Siege of Yorktown', 'Battle of Cowpens', 'Battle of Trenton'],
    1,
    'October 1781',
    'Combined American and French forces trapped Lord Cornwallis while a French fleet blocked the Chesapeake.',
    'Easy'
  ],
  [
    'Which 1789 Parisian fortress was stormed by citizens on July 14, sparking the French Revolution?',
    ['The Conciergerie', 'The Bastille', 'The Tuileries', 'Les Invalides'],
    1,
    'July 14, 1789',
    'Citizens sought gunpowder and viewed the medieval fortress as a symbol of royal absolutism.',
    'Easy'
  ],
  [
    'Who led the Haitian Revolution from 1791 until his capture by French forces in 1802?',
    ['Jean-Jacques Dessalines', 'Toussaint Louverture', 'Henri Christophe', 'Simon Bolivar'],
    1,
    '1791–1802',
    'Haiti declared independence in 1804 as the world’s first Black republic.',
    'Easy'
  ],
  [
    'Which French chemist established the law of conservation of mass and named oxygen?',
    ['Antoine Lavoisier', 'Joseph Priestley', 'John Dalton', 'Humphry Davy'],
    0,
    '1789',
    'Lavoisier helped transform alchemy into quantitative modern chemistry before being executed in 1794.',
    'Medium'
  ],
  [
    'Which British campaigner led the parliamentary effort to abolish the British slave trade in 1807?',
    ['Thomas Clarkson', 'William Wilberforce', 'Olaudah Equiano', 'Granville Sharp'],
    1,
    'Slave Trade Act, 1807',
    'Full emancipation across most British colonies followed in 1833.',
    'Easy'
  ],
  [
    'Which 1803 transaction doubled the territory of the United States?',
    ['Gadsden Purchase', 'Louisiana Purchase', 'Treaty of Guadalupe Hidalgo', 'Oregon Treaty'],
    1,
    '1803',
    'France sold roughly 828,000 square miles of territory for fifteen million dollars.',
    'Easy'
  ],
  [
    'Which 1805 naval battle secured British maritime supremacy against the combined French and Spanish fleets?',
    ['Battle of the Nile', 'Battle of Trafalgar', 'Battle of Jutland', 'Battle of Lepanto'],
    1,
    'October 1805',
    'Admiral Horatio Nelson broke the enemy line in two columns before dying aboard HMS Victory.',
    'Easy'
  ],
  [
    'Which 1814–1815 diplomatic gathering redrew Europe’s borders after Napoleon’s defeat?',
    ['Treaty of Paris', 'Congress of Vienna', 'Congress of Berlin', 'Conference of Yalta'],
    1,
    '1814–1815',
    'Hosted by Austria’s Prince Metternich, it aimed to maintain a long-term balance of power.',
    'Medium'
  ],
  [
    'Which South American liberator helped win independence for Venezuela, Colombia, Ecuador, and Peru?',
    ['Jose de San Martin', 'Simon Bolivar', 'Bernardo O’Higgins', 'Miguel Hidalgo'],
    1,
    '1810s–1820s',
    'Known as El Libertador, Bolivar envisioned a united federation of Spanish American republics.',
    'Easy'
  ],
  [
    'Which British mathematician wrote the first published algorithm intended for Charles Babbage’s Analytical Engine?',
    ['Mary Somerville', 'Ada Lovelace', 'Grace Hopper', 'Alan Turing'],
    1,
    '1843',
    'Lovelace predicted that general-purpose computing machines could manipulate music and symbols beyond numbers.',
    'Easy'
  ],
  [
    'Which English pioneer of modern nursing revolutionized hospital sanitation during the Crimean War?',
    ['Clara Barton', 'Florence Nightingale', 'Mary Seacole', 'Edith Cavell'],
    1,
    'Scutari, 1854–1856',
    'Nightingale also used innovative polar-area statistical diagrams to persuade officials to reform care.',
    'Easy'
  ],
  [
    'Which 1848 gathering in New York launched the organized U.S. women’s suffrage movement?',
    ['Philadelphia Convention', 'Seneca Falls Convention', 'Harlem Renaissance', 'Pullman Strike'],
    1,
    'July 1848',
    'Organized by Elizabeth Cady Stanton and Lucretia Mott, it issued the Declaration of Sentiments.',
    'Medium'
  ],
  [
    'Which Italian statesman worked with Giuseppe Garibaldi to unify Italy in 1861?',
    ['Count Camillo di Cavour', 'Metternich', 'Victor Hugo', 'Otto von Bismarck'],
    0,
    'Il Risorgimento, 1861',
    'While Garibaldi’s Redshirts took the south, Cavour orchestrated diplomacy from Piedmont-Sardinia.',
    'Medium'
  ],
  [
    'Which Prussian chancellor unified Germany into a single empire in 1871?',
    ['Helmuth von Moltke', 'Otto von Bismarck', 'Wilhelm II', 'Frederick the Great'],
    1,
    'January 1871',
    'Bismarck’s "blood and iron" diplomacy followed wars with Denmark, Austria, and France.',
    'Easy'
  ],
  [
    'Which 1863 executive order declared enslaved people in Confederate territory to be free?',
    ['Homestead Act', 'Emancipation Proclamation', 'Thirteenth Amendment', 'Wilmot Proviso'],
    1,
    'January 1, 1863',
    'Issued by President Abraham Lincoln, it transformed the Union war effort into a war against slavery.',
    'Easy'
  ],
  [
    'Which Russian chemist published the periodic table of elements in 1869, leaving gaps for undiscovered elements?',
    ['Dmitri Mendeleev', 'Antoine Lavoisier', 'Niels Bohr', 'Robert Bunsen'],
    0,
    '1869',
    'Mendeleev accurately predicted the properties of gallium and germanium before they were isolated.',
    'Easy'
  ],
  [
    'Which 1884–1885 European conference partitioned Africa into colonial spheres without African representation?',
    ['Congress of Vienna', 'Berlin Conference', 'Fashoda Incident', 'Versailles Conference'],
    1,
    'Berlin, 1884–1885',
    'Rival European powers drew arbitrary borders that cut across long-standing linguistic and political communities.',
    'Medium'
  ],
  [
    'Which country became the first self-governing nation to grant women the right to vote in 1893?',
    ['Finland', 'New Zealand', 'Australia', 'Norway'],
    1,
    'September 1893',
    'Campaigners led by Kate Sheppard gathered petitions signed by nearly a quarter of adult women.',
    'Medium'
  ],
  [
    'Which German physicist discovered X-rays in 1895?',
    ['Max Planck', 'Wilhelm Rontgen', 'Heinrich Hertz', 'Ernest Rutherford'],
    1,
    'November 1895',
    'Rontgen received the very first Nobel Prize in Physics in 1901.',
    'Medium'
  ],
  [
    'Which Ottoman-era reformist movement took power in 1908 calling for constitutional government?',
    ['Janissaries', 'Young Turks', 'Tanzimat Council', 'Mamluks'],
    1,
    'July 1908',
    'The Committee of Union and Progress restored the 1876 Ottoman constitution.',
    'Hard'
  ],
  [
    'Which Norwegian explorer led the first expedition to reach the Geographic South Pole in December 1911?',
    ['Robert Falcon Scott', 'Roald Amundsen', 'Ernest Shackleton', 'Fridtjof Nansen'],
    1,
    'December 14, 1911',
    'Amundsen relied on sled dogs and Inuit cold-weather clothing, arriving five weeks before Scott.',
    'Easy'
  ],
  [
    'Which June 1914 assassination in Sarajevo triggered the July Crisis leading to World War I?',
    ['Tsar Nicholas II', 'Archduke Franz Ferdinand', 'Kaiser Wilhelm I', 'King Umberto I'],
    1,
    'June 28, 1914',
    'Gavrilo Princip shot the Austro-Hungarian heir and his wife Sophie during a motorcade.',
    'Easy'
  ],
  [
    'Which German process, scaled around 1913, synthesized ammonia from nitrogen in the air for fertilizer?',
    ['Bessemer process', 'Haber-Bosch process', 'Solvay process', 'Ostwald process'],
    1,
    '1909–1913',
    'Synthetic nitrogen fertilizer dramatically increased global food production over the twentieth century.',
    'Hard'
  ],
  [
    'Which 1917 intercepted telegram proposed a German-Mexican alliance against the United States?',
    ['Ems Dispatch', 'Zimmermann Telegram', 'Balfour Declaration', 'Sykes-Picot Note'],
    1,
    'January 1917',
    'British naval intelligence decoded the message, helping push the U.S. into World War I.',
    'Medium'
  ],
  [
    'Which 1917 revolution toppled the Russian Tsar before the October Bolshevik takeover?',
    ['Decembrist Revolt', 'February Revolution', 'Kronstadt Rebellion', 'Pugachev’s Rebellion'],
    1,
    'March 1917 (N.S.)',
    'Food shortages and war exhaustion led soldiers in Petrograd to side with striking workers.',
    'Medium'
  ],
  [
    'Who led the nationalist movement that founded the modern Republic of Turkey in 1923?',
    ['Ismet Inonu', 'Mustafa Kemal Ataturk', 'Enver Pasha', 'Reza Shah'],
    1,
    'October 1923',
    'Ataturk introduced secular legal codes, women’s suffrage, and a Latin-based Turkish alphabet.',
    'Easy'
  ],
  [
    'Which 1929 U.S. stock market crash ushered in the decade-long Great Depression?',
    ['Panic of 1907', 'Wall Street Crash of 1929', 'Black Wednesday', 'Tulip Mania'],
    1,
    'October 1929',
    'Global trade plunged as banks failed and countries raised retaliatory tariffs.',
    'Easy'
  ],
  [
    'What was the 1930 non-violent protest led by Mahatma Gandhi against a British colonial monopoly called?',
    ['Quit India March', 'Salt March (Dandi March)', 'Khilafat Movement', 'Swadeshi Boycott'],
    1,
    'March–April 1930',
    'Gandhi walked 240 miles to the Arabian Sea to evaporate natural salt in open defiance of the tax.',
    'Easy'
  ],
  [
    'Which 1934–1935 military retreat carried Chinese Communist forces over 6,000 miles to Yan’an?',
    ['Boxer March', 'The Long March', 'Northern Expedition', 'Taiping Campaign'],
    1,
    '1934–1935',
    'During the march, Mao Zedong emerged as the undisputed leader of the Chinese Communist Party.',
    'Medium'
  ],
  [
    'Which 1941 Atlantic meeting between Roosevelt and Churchill outlined post-war self-determination goals?',
    ['Casablanca Conference', 'Atlantic Charter', 'Yalta Declaration', 'Dumbarton Oaks'],
    1,
    'August 1941',
    'The eight-point statement later inspired the founding principles of the United Nations.',
    'Medium'
  ],
  [
    'Which June 1942 naval clash broke Japanese carrier superiority in the Pacific War?',
    ['Battle of Coral Sea', 'Battle of Midway', 'Battle of Leyte Gulf', 'Battle of Guadalcanal'],
    1,
    'June 4–7, 1942',
    'U.S. codebreakers anticipated the ambush, allowing dive-bombers to sink four Japanese carriers.',
    'Easy'
  ],
  [
    'Which June 6, 1944 Allied operation opened the Western Front in Normandy?',
    ['Operation Barbarossa', 'Operation Overlord (D-Day)', 'Operation Market Garden', 'Operation Torch'],
    1,
    'June 6, 1944',
    'Over 150,000 Allied troops landed across five Normandy beaches in history’s largest amphibious assault.',
    'Easy'
  ],
  [
    'Which 1944 conference in New Hampshire created the IMF and the World Bank?',
    ['San Francisco Conference', 'Bretton Woods Conference', 'Potsdam Conference', 'Bandung Conference'],
    1,
    'July 1944',
    'Forty-four Allied nations designed a postwar monetary order anchored to the U.S. dollar and gold.',
    'Medium'
  ],
  [
    'Which 1947 U.S. economic recovery program poured over $13 billion into rebuilding Western Europe?',
    ['Truman Doctrine', 'Marshall Plan', 'Lend-Lease Act', 'Dawes Plan'],
    1,
    '1948–1951',
    'Officially the European Recovery Program, it helped restore factories, railways, and currencies.',
    'Easy'
  ],
  [
    'Which 1948–1949 Allied air campaign kept West Berlin supplied during a Soviet blockade?',
    ['Berlin Airlift', 'Operation Vittles Only', 'Potsdam Relief', 'Rhine Corridor'],
    0,
    'June 1948 – May 1949',
    'Cargo planes landed every few minutes carrying coal, food, and medicine for over two million residents.',
    'Easy'
  ],
  [
    'Which 1955 meeting in Indonesia brought 29 newly independent Asian and African nations together?',
    ['Geneva Summit', 'Bandung Conference', 'Addis Ababa Summit', 'Cairo Conference'],
    1,
    'April 1955',
    'Bandung laid the groundwork for the Non-Aligned Movement during the Cold War.',
    'Hard'
  ],
  [
    'Which sub-Saharan African colony became independent as Ghana in 1957 under Kwame Nkrumah?',
    ['Gold Coast', 'Tanganyika', 'Northern Rhodesia', 'Nyasaland'],
    0,
    'March 6, 1957',
    'Ghana became the first European colony in sub-Saharan Africa to gain independence in the postwar wave.',
    'Medium'
  ],
  [
    'In which year did seventeen African nations achieve independence, earning it the title "Year of Africa"?',
    ['1957', '1960', '1963', '1975'],
    1,
    '1960',
    'Countries including Nigeria, Senegal, Congo, Kenya’s neighbors, and Madagascar became sovereign states.',
    'Medium'
  ],
  [
    'Which 1962 Cold War standoff brought the United States and Soviet Union closest to nuclear war?',
    ['Berlin Crisis', 'Cuban Missile Crisis', 'Suez Crisis', 'U-2 Incident'],
    1,
    'October 1962',
    'Secret diplomacy led the USSR to withdraw missiles from Cuba in exchange for pledges on Cuba and Turkey.',
    'Easy'
  ],
  [
    'Which American marine biologist sparked the modern environmental movement with Silent Spring in 1962?',
    ['Jane Goodall', 'Rachel Carson', 'Wangari Maathai', 'Sylvia Earle'],
    1,
    '1962',
    'Carson documented how indiscriminate pesticide use harmed ecosystems and food chains.',
    'Easy'
  ],
  [
    'Which 1967 organization was formed in Bangkok to foster regional stability in Southeast Asia?',
    ['SEATO', 'ASEAN', 'APEC', 'SAARC'],
    1,
    'August 1967',
    'Indonesia, Malaysia, the Philippines, Singapore, and Thailand were its five founding members.',
    'Medium'
  ],
  [
    'Which 1978 diplomatic accord mediated at Camp David led to peace between Egypt and Israel?',
    ['Oslo Accords', 'Camp David Accords', 'Dayton Agreement', 'Taif Agreement'],
    1,
    'September 1978',
    'Anwar Sadat and Menachem Begin signed the framework hosted by U.S. President Jimmy Carter.',
    'Medium'
  ],
  [
    'Which global campaign officially certified the complete eradication of smallpox in 1980?',
    ['UNICEF Polio Drive', 'World Health Organization Campaign', 'Red Cross Charter', 'Pasteur Initiative'],
    1,
    'May 1980',
    'Smallpox remains the only human infectious disease eradicated globally.',
    'Easy'
  ],
  [
    'Which 1987 international treaty successfully phased out ozone-depleting CFC chemicals?',
    ['Kyoto Protocol', 'Montreal Protocol', 'Paris Agreement', 'Basel Convention'],
    1,
    'September 1987',
    'Widely considered the most successful environmental treaty in history, ratified universally.',
    'Medium'
  ],
  [
    'Which 1998 power-sharing agreement brought an end to decades of conflict in Northern Ireland?',
    ['Sunningdale Agreement', 'Good Friday Agreement', 'Maastricht Treaty', 'Schengen Accord'],
    1,
    'April 10, 1998',
    'Approved by referendums in both Northern Ireland and the Republic of Ireland.',
    'Medium'
  ],
  [
    'Which Kenyan environmentalist became the first African woman to win the Nobel Peace Prize in 2004?',
    ['Ellen Johnson Sirleaf', 'Wangari Maathai', 'Ngozi Okonjo-Iweala', 'Graça Machel'],
    1,
    'Green Belt Movement, 2004',
    'Maathai’s grassroots movement planted tens of millions of trees while advancing women’s rights.',
    'Medium'
  ],
  [
    'Which 2003 scientific consortium completed the first draft reference map of the human genome?',
    ['CERN', 'Human Genome Project', 'ITER', 'Apollo Consortium'],
    1,
    'April 2003',
    'International laboratories sequenced roughly three billion base pairs ahead of schedule.',
    'Easy'
  ],
  [
    'Which ancient Anatolian site dates to around 9600 BCE and features massive T-shaped stone pillars?',
    ['Catalhoyuk', 'Gobekli Tepe', 'Hattusa', 'Troy'],
    1,
    'Southeastern Turkey',
    'Built by hunter-gatherers millennia before pottery or metalworking.',
    'Hard'
  ],
  [
    'Which Phoenician colony in Iberia is considered one of the oldest continuously inhabited cities in Western Europe?',
    ['Cadiz (Gadir)', 'Cordoba', 'Toledo', 'Bilbao'],
    0,
    'c. 1100 BCE',
    'Located on an Atlantic peninsula, Gadir linked Mediterranean traders to Atlantic tin and silver.',
    'Hard'
  ],
  [
    'Which Persian royal highway stretched roughly 1,677 miles from Susa to Sardis?',
    ['Amber Road', 'Royal Road', 'Appian Way', 'Via Dolorosa'],
    1,
    '5th century BCE',
    'Herodotus praised Persian mounted couriers who inspired the motto about mail passing rain or snow.',
    'Medium'
  ],
  [
    'Which Athenian dramatic festival premiered tragedies by Aeschylus, Sophocles, and Euripides?',
    ['Panathenaia', 'City Dionysia', 'Eleusinian Mysteries', 'Isthmian Games'],
    1,
    '5th century BCE',
    'Civic judges awarded prizes to playwrights funded by wealthy Athenian citizens.',
    'Hard'
  ],
  [
    'Which 338 BCE battle established Macedonian dominance over mainland Greece under Philip II?',
    ['Battle of Leuctra', 'Battle of Chaeronea', 'Battle of Issus', 'Battle of Marathon'],
    1,
    '338 BCE',
    'An eighteen-year-old Alexander commanded the decisive left-wing cavalry charge.',
    'Hard'
  ],
  [
    'Which Greco-Bactrian or Indo-Greek king appears as a philosophical questioner in the Milinda Panha?',
    ['Antiochus III', 'Menander I', 'Demetrius I', 'Seleucus I'],
    1,
    'c. 150 BCE',
    'Menander’s silver coins circulated widely from Kabul across northwestern India.',
    'Hard'
  ],
  [
    'Which Roman engineering manual by Vitruvius became the sole surviving architectural treatise from antiquity?',
    ['Natural History', 'De Architectura', 'Georgics', 'Agricola'],
    1,
    'c. 15 BCE',
    'Rediscovered during the Renaissance, it inspired Leonardo da Vinci’s Vitruvian Man.',
    'Hard'
  ],
  [
    'Which Nabataean caravan capital in modern Jordan was carved directly into rose-colored sandstone cliffs?',
    ['Palmyra', 'Petra', 'Jerash', 'Hatra'],
    1,
    'c. 300 BCE – 106 CE',
    'Petra prospered by controlling desert frankincense routes and engineered flash-flood cisterns.',
    'Easy'
  ],
  [
    'Which queen of Palmyra challenged Roman rule in Syria and Egypt in the third century CE?',
    ['Cleopatra VII', 'Zenobia', 'Boudica', 'Cartimandua'],
    1,
    '267–272 CE',
    'Emperor Aurelian eventually defeated Palmyra and captured Zenobia.',
    'Medium'
  ],
  [
    'Which Celtic queen of the Iceni led a major uprising against Roman Britain around 60 CE?',
    ['Zenobia', 'Boudica', 'Brigantia', 'Eleanor of Aquitaine'],
    1,
    '60–61 CE',
    'Boudica’s forces burned Camulodunum, Londinium, and Verulamium before falling in battle.',
    'Easy'
  ],
  [
    'Which sixth-century Byzantine legal compilation organized centuries of Roman statutes into a single code?',
    ['Theodosian Code', 'Corpus Juris Civilis (Justinian Code)', 'Twelve Tables', 'Salic Law'],
    1,
    '529–534 CE',
    'Justinian’s legal commission shaped civil law traditions across continental Europe.',
    'Medium'
  ],
  [
    'Which 843 treaty divided Charlemagne’s Carolingian Empire among his three grandsons?',
    ['Treaty of Verdun', 'Treaty of Mersen', 'Concordat of Worms', 'Peace of God'],
    0,
    'August 843 CE',
    'It created West Francia, Middle Francia, and East Francia—forerunners of France and Germany.',
    'Medium'
  ],
  [
    'Which 1086 survey commissioned by William the Conqueror recorded landholdings across England?',
    ['Bayeux Tapestry', 'Domesday Book', 'Anglo-Saxon Chronicle', 'Pipe Rolls'],
    1,
    '1086 CE',
    'Compiled in less than a year, it assessed estates for royal taxation and feudal obligations.',
    'Easy'
  ],
  [
    'Which 12th-century ruler united Egypt and Syria and recaptured Jerusalem in 1187?',
    ['Baybars', 'Saladin', 'Nur ad-Din', 'Alp Arslan'],
    1,
    '1187 CE',
    'Saladin earned admiration across both Muslim and Christian chronicles for chivalry at Jerusalem.',
    'Easy'
  ],
  [
    'Which 13th-century Italian merchant family’s account sparked European curiosity about China and paper money?',
    ['Medici', 'Polo (Marco Polo)', 'Cabot', 'Vespucci'],
    1,
    '1271–1295 CE',
    'Marco Polo dictated his travels while imprisoned in Genoa after returning from Kublai Khan’s court.',
    'Easy'
  ],
  [
    'Which 1356 German imperial decree established the seven prince-electors who chose the emperor?',
    ['Golden Bull of 1356', 'Edict of Worms', 'Pragmatic Sanction', 'Statute of Kilkenny'],
    0,
    '1356 CE',
    'Issued by Emperor Charles IV, it remained constitutional law until 1806.',
    'Hard'
  ],
  [
    'Which Bohemian reformer was burned at the stake in 1415, sparking the Hussite movement?',
    ['John Wycliffe', 'Jan Hus', 'Girolamo Savonarola', 'Ulrich Zwingli'],
    1,
    'Council of Constance, 1415',
    'Hus preached in Czech and argued for scripture’s authority and communion in both kinds.',
    'Medium'
  ],
  [
    'Which Italian Renaissance architect engineered the brick double-shell dome of Florence Cathedral?',
    ['Leon Battista Alberti', 'Filippo Brunelleschi', 'Donato Bramante', 'Andrea Palladio'],
    1,
    '1420–1436',
    'Brunelleschi invented hoisting machines and herringbone brickwork so the dome stood without timber centering.',
    'Medium'
  ],
  [
    'Which Florentine banking family used double-entry bookkeeping and patronized Botticelli and Michelangelo?',
    ['Borgia', 'Medici', 'Sforza', 'Fugger'],
    1,
    '15th century',
    'Cosimo and Lorenzo de’ Medici turned Florence into the financial and artistic heart of the Renaissance.',
    'Easy'
  ],
  [
    'Which 1525 battle in northern Italy saw Habsburg forces capture French King Francis I?',
    ['Battle of Marignano', 'Battle of Pavia', 'Battle of Lepanto', 'Battle of Mohacs'],
    1,
    'February 1525',
    'Spanish arquebusiers demonstrated how handheld firearms could shatter armored knightly cavalry.',
    'Hard'
  ],
  [
    'Which 1571 Mediterranean naval victory halted Ottoman westward expansion at sea?',
    ['Battle of Preveza', 'Battle of Lepanto', 'Siege of Malta', 'Battle of Diu'],
    1,
    'October 1571',
    'Holy League galleys led by Don John of Austria defeated the Ottoman fleet off western Greece.',
    'Medium'
  ],
  [
    'Which English fleet victory in 1588 thwarted Philip II’s planned invasion of England?',
    ['Battle of Gravelines (Spanish Armada)', 'Battle of Medway', 'Battle of Trafalgar', 'Battle of Cadiz'],
    0,
    'July–August 1588',
    'Fireships, agile English gunnery, and North Sea storms scattered the massive Spanish fleet.',
    'Easy'
  ],
  [
    'Which 16th-century Inca stronghold high in the Urubamba Valley escaped Spanish discovery?',
    ['Ollantaytambo', 'Machu Picchu', 'Sacsayhuaman', 'Vilcabamba'],
    1,
    'Built c. 1450 CE',
    'Astronomical alignments like the Intihuatana stone anchored rituals of the royal estate.',
    'Easy'
  ],
  [
    'Which astronomical event did Johannes Kepler’s three laws describe?',
    ['Lunar eclipses only', 'Planetary orbits around the Sun', 'Comet composition', 'Speed of light'],
    1,
    '1609–1619',
    'Kepler proved planets move in ellipses rather than perfect circles, sweeping equal areas in equal times.',
    'Easy'
  ],
  [
    'Which 1620 ship carried English Pilgrims to Cape Cod, where they signed the Mayflower Compact?',
    ['Santa Maria', 'Mayflower', 'Endeavour', 'Golden Hind'],
    1,
    'November 1620',
    'The Mayflower Compact was an early self-governing covenant among colonial settlers.',
    'Easy'
  ],
  [
    'Which 1637 economic bubble in the Dutch Republic centered on rare flower bulbs?',
    ['South Sea Bubble', 'Tulip Mania', 'Mississippi Scheme', 'Railway Mania'],
    1,
    'Haarlem, 1636–1637',
    'Contracts for striped Semper Augustus bulbs briefly traded for the value of town houses.',
    'Easy'
  ],
  [
    'Which French finance minister under Louis XIV promoted state-led mercantilism and canals?',
    ['Cardinal Richelieu', 'Jean-Baptiste Colbert', 'Jacques Necker', 'Anne Robert Turgot'],
    1,
    '1661–1683',
    'Colbert built the French royal navy, standardized manufactures, and funded the Academy of Sciences.',
    'Hard'
  ],
  [
    'Which 1707 Act of Union united the parliaments of England and Scotland into Great Britain?',
    ['Treaty of Union', 'Act of Settlement', 'Treaty of Ryswick', 'Act of Supremacy'],
    0,
    'May 1707',
    'Scotland kept its distinct legal system and Church of Scotland while sharing a single Parliament.',
    'Medium'
  ],
  [
    'Which British clockmaker solved the problem of finding longitude at sea with his H4 marine chronometer?',
    ['Robert Hooke', 'John Harrison', 'Christiaan Huygens', 'George Graham'],
    1,
    '1759–1761',
    'Harrison’s pocket-sized sea watch lost barely five seconds on a voyage to Jamaica.',
    'Medium'
  ],
  [
    'Which French encyclopedists edited the 28-volume Encyclopédie during the Enlightenment?',
    ['Diderot and d’Alembert', 'Voltaire and Rousseau', 'Condorcet and Laplace', 'Buffon and Cuvier'],
    0,
    '1751–1772',
    'Illustrated plates documented trades, sciences, and philosophy across Europe.',
    'Medium'
  ],
  [
    'Which 1773 protest in Boston Harbor targeted East India Company tea cargoes?',
    ['Stamp Act Congress', 'Boston Tea Party', 'Gaspee Affair', 'Olive Branch Petition'],
    1,
    'December 1773',
    'Sons of Liberty boarded three ships to protest taxation without parliamentary representation.',
    'Easy'
  ],
  [
    'Which British explorer charted New Zealand and eastern Australia aboard HMS Endeavour?',
    ['Abel Tasman', 'James Cook', 'Matthew Flinders', 'George Vancouver'],
    1,
    '1768–1771',
    'Cook’s crews prevented scurvy using fresh provisions, sauerkraut, and citrus.',
    'Easy'
  ],
  [
    'Which 1804 legal compilation standardized French civil law and spread across much of Europe?',
    ['Treaty of Amiens', 'Napoleonic Code', 'Declaration of Rights', 'Concordat of 1801'],
    1,
    'March 1804',
    'The Civil Code abolished feudal privileges and influenced legal systems from Louisiana to Japan.',
    'Medium'
  ],
  [
    'Which 1815 Belgian battle marked Napoleon Bonaparte’s final defeat?',
    ['Battle of Austerlitz', 'Battle of Waterloo', 'Battle of Leipzig', 'Battle of Marengo'],
    1,
    'June 18, 1815',
    'Anglo-Allied forces under Wellington held until Prussian troops under Blucher arrived.',
    'Easy'
  ],
  [
    'Which 1825 British line was the world’s first public railway to use steam locomotives?',
    ['Liverpool and Manchester', 'Stockton and Darlington', 'Great Western Railway', 'Trans-Siberian'],
    1,
    'September 1825',
    'George Stephenson’s Locomotion No. 1 hauled coal and passengers in County Durham.',
    'Hard'
  ],
  [
    'Which American inventor sent the famous telegraph message "What hath God wrought" in 1844?',
    ['Samuel Morse', 'Alexander Graham Bell', 'Cyrus Field', 'Thomas Edison'],
    0,
    'May 24, 1844',
    'The line linked the U.S. Supreme Court chamber in Washington to Baltimore.',
    'Easy'
  ],
  [
    'Which 1858 engineering milestone laid the first telegraph cable across the Atlantic seabed?',
    ['Great Eastern Cable', 'Cyrus Field’s Transatlantic Cable', 'Suez Telegraph', 'Pacific Link'],
    1,
    'August 1858',
    'Although the first cable failed after three weeks, a durable line succeeded in 1866.',
    'Medium'
  ],
  [
    'Which 1861 reform emancipated more than twenty million Russian serfs?',
    ['October Manifesto', 'Emancipation Reform of 1861', 'Stolypin Reforms', 'Kiev Charter'],
    1,
    'Tsar Alexander II, 1861',
    'Serfs gained legal freedom, though redemption payments burdened peasant communes for decades.',
    'Medium'
  ],
  [
    'Which treaty ended the First Opium War in 1842 and ceded Hong Kong Island to Britain?',
    ['Treaty of Shimonoseki', 'Treaty of Nanking', 'Treaty of Tientsin', 'Convention of Peking'],
    1,
    'August 1842',
    'It opened five treaty ports to foreign commerce and became the first of China’s "unequal treaties."',
    'Medium'
  ],
  [
    'Which African queen of the Asante Empire led the 1900 resistance against British control of the Golden Stool?',
    ['Queen Nzinga', 'Yaa Asantewaa', 'Queen Amina', 'Ranavalona I'],
    1,
    'War of the Golden Stool, 1900',
    'Though exiled to the Seychelles, Yaa Asantewaa successfully kept the sacred Golden Stool hidden.',
    'Medium'
  ],
  [
    'Which 17th-century Angolan ruler resisted Portuguese slave-raiding for three decades?',
    ['Yaa Asantewaa', 'Queen Nzinga of Ndongo and Matamba', 'Beatriz Kimpa Vita', 'Makeda'],
    1,
    '1624–1663',
    'Nzinga forged regional coalitions and used brilliant diplomacy to preserve her kingdom’s autonomy.',
    'Medium'
  ],
  [
    'Which 1906 British battleship launched a global naval arms race by featuring all-big-gun turrets and steam turbines?',
    ['HMS Victory', 'HMS Dreadnought', 'SMS Bismarck', 'USS Monitor'],
    1,
    'February 1906',
    'Dreadnought made every earlier battleship immediately obsolete.',
    'Medium'
  ],
  [
    'Which Austrian physicist co-discovered nuclear fission with Otto Hahn and Fritz Strassmann in 1938?',
    ['Marie Curie', 'Lise Meitner', 'Rosalind Franklin', 'Emmy Noether'],
    1,
    'December 1938',
    'Lise Meitner and Otto Frisch explained theoretically how splitting uranium atoms releases immense energy.',
    'Medium'
  ],
  [
    'Which 1945 UN charter signing took place in San Francisco with delegates from fifty nations?',
    ['League Covenant', 'United Nations Charter', 'Geneva Conventions', 'Universal Declaration'],
    1,
    'June 26, 1945',
    'The Charter entered into force on October 24, 1945, now celebrated as United Nations Day.',
    'Easy'
  ],
  [
    'Which 1949 defensive alliance linked North America and Western Europe under collective security?',
    ['Warsaw Pact', 'NATO', 'CENTO', 'ANZUS'],
    1,
    'April 1949',
    'Article 5 commits allies to treat an armed attack against one member as an attack against all.',
    'Easy'
  ],
  [
    'Which 1957 treaty created the European Economic Community, precursor to the European Union?',
    ['Treaty of Maastricht', 'Treaty of Rome', 'Treaty of Lisbon', 'Schengen Agreement'],
    1,
    'March 1957',
    'Six founding countries—Belgium, France, Italy, Luxembourg, the Netherlands, and West Germany—signed it.',
    'Medium'
  ],
  [
    'Which 1963 treaty signed by the U.S., USSR, and UK banned nuclear tests in the atmosphere, space, and underwater?',
    ['START I', 'Partial Test Ban Treaty', 'SALT II', 'INF Treaty'],
    1,
    'August 1963',
    'It sharply curtailed atmospheric radioactive fallout around the globe.',
    'Hard'
  ],
  [
    'Which 1975 Helsinki agreement recognized postwar European borders while affirming human rights commitments?',
    ['Helsinki Final Act', 'Reykjavik Summit', 'Geneva Accord', 'Paris Charter'],
    0,
    'August 1975',
    'Citizen monitoring groups across Eastern Europe used its human rights basket to press for reform.',
    'Hard'
  ],
  [
    'Which 1986 Soviet policy championed openness in media, public debate, and historical transparency?',
    ['Perestroika', 'Glasnost', 'Detente', 'New Economic Policy'],
    1,
    'Mikhail Gorbachev, 1986',
    'Paired with perestroika (economic restructuring), glasnost accelerated political change across the USSR.',
    'Easy'
  ],
  [
    'Which 1991 agreement created the single European market and introduced the framework for the euro?',
    ['Treaty of Rome', 'Maastricht Treaty', 'Treaty of Nice', 'Treaty of Amsterdam'],
    1,
    'Signed February 1992 (agreed Dec 1991)',
    'Maastricht formally established the European Union and European citizenship.',
    'Medium'
  ],
  [
    'Which 1994 free-trade agreement eliminated most tariffs among Canada, Mexico, and the United States?',
    ['GATT', 'NAFTA', 'TPP', 'Mercosur'],
    1,
    'Effective January 1994',
    'Later updated as USMCA in 2020.',
    'Easy'
  ],
  [
    'Which 1997 international treaty first set binding greenhouse-gas reduction targets for industrialized nations?',
    ['Montreal Protocol', 'Kyoto Protocol', 'Stockholm Declaration', 'Basel Accord'],
    1,
    'December 1997',
    'Named after the Japanese city where negotiations concluded.',
    'Medium'
  ],
  [
    'Which 1999 handoff returned full sovereignty of a vital interoceanic waterway to Panama?',
    ['Suez Handover', 'Panama Canal Transfer', 'Kiel Treaty', 'Bering Accord'],
    1,
    'December 31, 1999',
    'Followed the 1977 Torrijos-Carter Treaties establishing Panamanian control and canal neutrality.',
    'Easy'
  ],
  [
    'Which 2012 CERN announcement confirmed the particle responsible for giving fundamental particles mass?',
    ['Top quark', 'Higgs boson', 'Graviton', 'Tau neutrino'],
    1,
    'July 4, 2012',
    'Detected at the Large Hadron Collider nearly fifty years after Peter Higgs and others predicted it.',
    'Medium'
  ],
  [
    'Which 2015 LIGO observation first directly detected ripples in spacetime predicted by Einstein?',
    ['Cosmic microwave background', 'Gravitational waves', 'Dark energy lensing', 'Hawking radiation'],
    1,
    'September 2015 (announced Feb 2016)',
    'Twin laser interferometers measured sub-proton vibrations from two colliding black holes.',
    'Medium'
  ],
  [
    'Which ancient Anatolian empire fought Egypt to a stalemate at the Battle of Kadesh around 1274 BCE?',
    ['Assyrians', 'Hittites', 'Elamites', 'Lydians'],
    1,
    'c. 1274 BCE',
    'The aftermath produced the earliest surviving written international peace treaty in history.',
    'Medium'
  ],
  [
    'Which iron-smelting civilization flourished in central Nigeria between roughly 500 BCE and 200 CE?',
    ['Nok Culture', 'Ife Kingdom', 'Kanem Empire', 'Oyo Empire'],
    0,
    'c. 500 BCE – 200 CE',
    'Nok artisans crafted expressive life-sized terracotta sculptures alongside early iron tools.',
    'Hard'
  ],
  [
    'Which ancient Greek historian is remembered for his empirical History of the Peloponnesian War?',
    ['Herodotus', 'Thucydides', 'Xenophon', 'Polybius'],
    1,
    'c. 411 BCE',
    'Thucydides excluded divine intervention and analyzed power, fear, and political rhetoric.',
    'Medium'
  ],
  [
    'Which third-century BCE Chinese philosopher emphasized strict laws and state authority under Legalism?',
    ['Mencius', 'Han Feizi', 'Zhuangzi', 'Mozi'],
    1,
    'Warring States Period',
    'Legalist statecraft shaped the administrative centralization of the Qin Empire.',
    'Hard'
  ],
  [
    'Which Roman province did Trajan conquer north of the Danube, celebrated on Trajan’s Column?',
    ['Britannia', 'Dacia', 'Hispania', 'Mauretania'],
    1,
    '101–106 CE',
    'Dacia’s rich gold and silver mines funded massive public building projects in Rome.',
    'Hard'
  ],
  [
    'Which fourth-century CE collection of edicts issued in Milan legalized Christianity in the Roman Empire?',
    ['Council of Nicaea', 'Edict of Milan', 'Edict of Thessalonica', 'Peace of Constantine'],
    1,
    '313 CE',
    'Agreed by Constantine I and Licinius, it restored confiscated church property and granted freedom of worship.',
    'Easy'
  ],
  [
    'Which Byzantine emperor compiled the Greek anthology of agricultural and military manuals while reforming themes?',
    ['Constantine VII Porphyrogenitus', 'Leo III', 'Alexios I', 'Manuel I'],
    0,
    '10th century CE',
    'Known as the "born in the purple" scholar-emperor, he documented Byzantine court ceremonies and diplomacy.',
    'Hard'
  ],
  [
    'Which Vietnamese dynasty defeated three Mongol invasions in the 13th century, notably on the Bach Dang River?',
    ['Nguyen Dynasty', 'Tran Dynasty', 'Ly Dynasty', 'Le Dynasty'],
    1,
    '1258–1288 CE',
    'General Tran Hung Dao used submerged iron-tipped stakes at low tide to trap the Mongol fleet.',
    'Hard'
  ],
  [
    'Which medieval European university, founded in 1088, is the oldest continuously operating university in Europe?',
    ['University of Paris', 'University of Bologna', 'University of Oxford', 'University of Salamanca'],
    1,
    '1088 CE',
    'Students organized guilds in Bologna to hire renowned professors of Roman law.',
    'Medium'
  ],
  [
    'Which 1204 event saw Fourth Crusade forces divert and sack Constantinople?',
    ['Battle of Hattin', 'Sack of Constantinople', 'Siege of Acre', 'Treaty of Jaffa'],
    1,
    'April 1204',
    'The sack fractured Byzantine power for over fifty years and enriched Venice’s St. Mark’s Basilica.',
    'Medium'
  ],
  [
    'Which 14th-century pandemic killed an estimated one-third to one-half of Europe’s population?',
    ['Justinianic Plague', 'Black Death', 'Sweating Sickness', 'Antonine Plague'],
    1,
    '1347–1351 CE',
    'Caused by Yersinia pestis, it reshaped wages, serfdom, and medical thinking across Eurasia.',
    'Easy'
  ],
  [
    'Which North African historian wrote the Muqaddimah, pioneering sociology and philosophy of history in 1377?',
    ['Al-Masudi', 'Ibn Khaldun', 'Al-Tabari', 'Ibn Rushd'],
    1,
    '1377 CE',
    'Ibn Khaldun analyzed how group solidarity (asabiyyah) drives the rise and fall of dynasties.',
    'Hard'
  ],
  [
    'Which West African city’s Sankore Mosque and libraries housed hundreds of thousands of manuscripts?',
    ['Gao', 'Timbuktu', 'Jenne', 'Kano'],
    1,
    '14th–16th century',
    'Families in Timbuktu preserved astronomy, poetry, law, and medical manuscripts across generations.',
    'Easy'
  ],
  [
    'Which Portuguese navigator first rounded the southern tip of Africa in 1488?',
    ['Vasco da Gama', 'Bartolomeu Dias', 'Diogo Cao', 'Alfonso de Albuquerque'],
    1,
    '1488 CE',
    'Dias named it the Cape of Storms before King John II renamed it the Cape of Good Hope.',
    'Medium'
  ],
  [
    'Which 1513 expedition led by Vasco Nunez de Balboa crossed Panama to become the first Europeans to see what ocean?',
    ['Indian Ocean', 'Pacific Ocean', 'Arctic Ocean', 'Southern Ocean'],
    1,
    'September 1513',
    'Balboa called it the "South Sea" (Mar del Sur) before Magellan named it the Pacific.',
    'Easy'
  ],
  [
    'Which Spanish priest advocated against the mistreatment of Indigenous peoples in the Americas in 1542?',
    ['Ignatius of Loyola', 'Bartolome de las Casas', 'Junípero Serra', 'Francisco Pizarro'],
    1,
    'New Laws of 1542',
    'His writings prompted heated royal debates at Valladolid over Indigenous rights.',
    'Medium'
  ],
  [
    'Which 1545–1563 church council defined Catholic doctrine and reform in response to the Reformation?',
    ['Council of Nicaea', 'Council of Trent', 'Council of Basel', 'Diet of Speyer'],
    1,
    '1545–1563',
    'Trent established seminaries for clergy training and reaffirmed Catholic sacramental theology.',
    'Medium'
  ],
  [
    'Which Spanish silver mine in high-altitude Bolivia financed global trade from Manila to Seville?',
    ['Zacatecas', 'Potosi', 'Guanajuato', 'Huancavelica'],
    1,
    'Discovered 1545',
    'Silver from Potosi’s Cerro Rico became the era’s most widely circulated global trade currency.',
    'Medium'
  ],
  [
    'Which 1571 founding in the Philippines created a direct trans-Pacific galleon trade with Acapulco?',
    ['Cebu', 'Manila', 'Macau', 'Batavia'],
    1,
    'Manila Galleons, 1565–1815',
    'For 250 years, Spanish galleons exchanged American silver for Chinese silk, spices, and porcelain.',
    'Hard'
  ],
  [
    'Which Dutch jurist wrote The Freedom of the Seas in 1609, laying foundations for international maritime law?',
    ['Baruch Spinoza', 'Hugo Grotius', 'John Locke', 'Samuel Pufendorf'],
    1,
    'Mare Liberum, 1609',
    'Grotius argued that the open oceans belong to no single nation and are open to all shipping.',
    'Hard'
  ],
  [
    'Which English philosopher’s Two Treatises of Government argued for natural rights to life, liberty, and property?',
    ['Thomas Hobbes', 'John Locke', 'Edmund Burke', 'Jeremy Bentham'],
    1,
    '1689',
    'Locke contended that governments rule only by the consent of the governed.',
    'Easy'
  ],
  [
    'Which 1701–1714 European conflict decided whether a Bourbon prince could inherit the Spanish throne?',
    ['War of the Austrian Succession', 'War of the Spanish Succession', 'Great Northern War', 'Nine Years’ War'],
    1,
    'Peace of Utrecht, 1713',
    'Philip V kept Spain on condition that the French and Spanish crowns never unite.',
    'Hard'
  ],
  [
    'Which British agricultural pioneer popularized the mechanical seed drill in 1701?',
    ['Charles Townshend', 'Jethro Tull', 'Robert Bakewell', 'Arthur Young'],
    1,
    '1701',
    'Planting seeds in neat rows reduced waste and boosted yields during the Agricultural Revolution.',
    'Medium'
  ],
  [
    'Which 1765 parliamentary tax on printed paper united American colonists behind "no taxation without representation"?',
    ['Townshend Acts', 'Stamp Act', 'Navigation Acts', 'Sugar Act'],
    1,
    '1765',
    'Widespread boycotts forced Parliament to repeal the Stamp Act within a year.',
    'Easy'
  ],
  [
    'Which 1787 Northwest Ordinance banned slavery in the new U.S. territory north of the Ohio River?',
    ['Missouri Compromise', 'Northwest Ordinance', 'Land Ordinance of 1785', 'Compromise of 1850'],
    1,
    'July 1787',
    'It also outlined an orderly path for territories to enter the Union as equal states.',
    'Medium'
  ],
  [
    'Which 1812 conflict between the United States and Britain saw Washington’s public buildings burned in 1814?',
    ['Quasi-War', 'War of 1812', 'Mexican-American War', 'Aroostook War'],
    1,
    '1812–1815',
    'The Treaty of Ghent restored pre-war borders while boosting U.S. domestic manufacturing.',
    'Easy'
  ],
  [
    'Which 1823 U.S. foreign policy statement warned European powers against new colonization in the Americas?',
    ['Truman Doctrine', 'Monroe Doctrine', 'Roosevelt Corollary', 'Open Door Policy'],
    1,
    'December 1823',
    'Largely drafted by Secretary of State John Quincy Adams.',
    'Easy'
  ],
  [
    'Which 1848 European wave of uprisings demanded constitutions, national unity, and workers’ rights?',
    ['July Revolution', 'Revolutions of 1848 (Springtime of Peoples)', 'Paris Commune', 'Chartist Petition'],
    1,
    '1848',
    'Revolts erupted almost simultaneously in Paris, Vienna, Berlin, Budapest, and Milan.',
    'Medium'
  ],
  [
    'Which 1867 Canadian constitutional act united Ontario, Quebec, Nova Scotia, and New Brunswick?',
    ['Durham Report', 'British North America Act (Constitution Act)', 'Statute of Westminster', 'Meech Lake Accord'],
    1,
    'July 1, 1867',
    'Now celebrated annually as Canada Day.',
    'Medium'
  ],
  [
    'Which French military officer’s wrongful treason conviction in 1894 deeply divided Third Republic France?',
    ['Georges Boulanger', 'Alfred Dreyfus', 'Ferdinand Foch', 'Philippe Petain'],
    1,
    'Dreyfus Affair, 1894–1906',
    'Émile Zola’s open letter "J’Accuse!" helped expose forged evidence and win Dreyfus’s exoneration.',
    'Medium'
  ],
  [
    'Which 1901 federation united six British colonies into the Commonwealth of Australia?',
    ['Waitangi Compact', 'Australian Federation of 1901', 'Balfour Report', 'Melbourne Charter'],
    1,
    'January 1, 1901',
    'Edmund Barton became Australia’s first Prime Minister.',
    'Medium'
  ],
  [
    'Which 1918–1919 global pandemic infected roughly one-third of the world’s population?',
    ['Asian Flu', '1918 Influenza Pandemic', 'Hong Kong Flu', 'Cholera Pandemic'],
    1,
    '1918–1919',
    'Spread rapidly along wartime troop and shipping routes as World War I ended.',
    'Easy'
  ],
  [
    'Which 1928 international pact saw more than sixty nations pledge to renounce war as national policy?',
    ['Locarno Treaties', 'Kellogg-Briand Pact', 'Washington Naval Treaty', 'Rapallo Treaty'],
    1,
    'August 1928',
    'Though lacking enforcement mechanisms, it helped establish legal precedent for crimes against peace.',
    'Hard'
  ],
  [
    'Which 1936–1939 conflict served as a brutal testing ground for modern aerial bombing before World War II?',
    ['Winter War', 'Spanish Civil War', 'Chaco War', 'Italo-Ethiopian War'],
    1,
    '1936–1939',
    'Pablo Picasso painted Guernica in response to the 1937 bombing of the Basque town.',
    'Easy'
  ],
  [
    'Which June 1940 evacuation rescued more than 338,000 Allied soldiers from beaches in northern France?',
    ['Operation Sealion', 'Dunkirk Evacuation (Operation Dynamo)', 'Anzio Landing', 'Dieppe Raid'],
    1,
    'May–June 1940',
    'Naval vessels alongside hundreds of civilian "little ships" ferried troops across the English Channel.',
    'Easy'
  ],
  [
    'Which Soviet mathematician and rocket designer led the Sputnik and Vostok space programs in secret?',
    ['Valentin Glushko', 'Sergei Korolev', 'Konstantin Tsiolkovsky', 'Yuri Kondratyuk'],
    1,
    '1957–1966',
    'Known publicly during his lifetime only as the "Chief Designer."',
    'Hard'
  ],
  [
    'Which American NASA mathematician’s orbital calculations verified John Glenn’s 1962 Friendship 7 flight?',
    ['Margaret Hamilton', 'Katherine Johnson', 'Sally Ride', 'Grace Hopper'],
    1,
    'NASA Langley, 1962',
    'Glenn famously asked for Katherine Johnson to double-check the electronic computer’s orbital numbers.',
    'Easy'
  ],
  [
    'Which 1963 founding meeting in Addis Ababa established the Organisation of African Unity?',
    ['Cairo Summit', 'Addis Ababa Summit', 'Lagos Plan', 'Kampala Conference'],
    1,
    'May 25, 1963',
    'Thirty-two independent African states signed the charter that later evolved into the African Union.',
    'Medium'
  ],
  [
    'Which 1972 U.S.-Soviet agreement capped strategic nuclear missile launchers for the first time?',
    ['SALT I', 'Geneva Accords', 'New START', 'Helsinki Pact'],
    0,
    'May 1972',
    'Signed in Moscow alongside the Anti-Ballistic Missile Treaty.',
    'Hard'
  ],
  [
    'Which 1989 Baltic human chain stretched over 400 miles across Estonia, Latvia, and Lithuania?',
    ['Velvet Chain', 'Baltic Way', 'Solidarity March', 'Singing Accord'],
    1,
    'August 23, 1989',
    'Roughly two million citizens joined hands in peaceful protest on the 50th anniversary of the Molotov-Ribbentrop Pact.',
    'Medium'
  ],
  [
    'Which 1990 agreement ended the Cold War division of Germany and permitted full German reunification?',
    ['Two Plus Four Treaty', 'Potsdam Accord', 'Belovezha Accords', 'Malta Communique'],
    0,
    'September 1990',
    'Signed by the two German states plus France, the UK, the USSR, and the United States.',
    'Medium'
  ],
  [
    'Which 2002 international tribunal opened in The Hague as the first permanent treaty-based criminal court?',
    ['International Court of Justice', 'International Criminal Court (ICC)', 'Nuremberg Tribunal', 'Permanent Court of Arbitration'],
    1,
    'Rome Statute, 2002',
    'Established to prosecute genocide, crimes against humanity, and war crimes.',
    'Medium'
  ],
  [
    'Which 2015 climate agreement saw nearly two hundred nations pledge to limit global warming well below 2°C?',
    ['Copenhagen Accord', 'Paris Agreement', 'Kyoto II', 'Rio Agenda 21'],
    1,
    'December 2015',
    'Countries submit updated Nationally Determined Contributions on a five-year cycle.',
    'Easy'
  ],
  [
    'Which ancient Anatolian kingdom under King Croesus popularized standardized gold and silver coins?',
    ['Phrygia', 'Lydia', 'Urartu', 'Cilicia'],
    1,
    'c. 6th century BCE',
    'Stamped electrum and gold coins from Sardis transformed commerce across the Aegean.',
    'Medium'
  ],
  [
    'Which early agricultural village in central Anatolia featured tightly packed mudbrick houses entered from rooftops?',
    ['Jericho', 'Catalhoyuk', 'Uruk', 'Ur'],
    1,
    'c. 7400–6200 BCE',
    'Residents painted hunting scenes and bulls on interior plaster walls.',
    'Hard'
  ],
  [
    'Which Greek physician of Kos is called the Father of Medicine for seeking natural rather than supernatural causes?',
    ['Galen', 'Hippocrates', 'Herophilos', 'Dioscorides'],
    1,
    'c. 460–370 BCE',
    'Medical graduates still echo ethical principles associated with the Hippocratic tradition.',
    'Easy'
  ],
  [
    'Which Indian astronomer and mathematician wrote Aryabhatiya in 499 CE, estimating pi to four decimal places?',
    ['Brahmagupta', 'Aryabhata', 'Bhaskara II', 'Madhava'],
    1,
    '499 CE',
    'Aryabhata also explained lunar and solar eclipses as shadows cast by the Earth and Moon.',
    'Medium'
  ],
  [
    'Which Chinese invention of the Song Dynasty enabled oceanic navigation even under overcast skies?',
    ['Astrolabe', 'Magnetic mariner’s compass', 'Sextant', 'Chronometer'],
    1,
    'c. 11th century CE',
    'Written accounts by Shen Kuo and Zhu Yu describe magnetized needles floated in water.',
    'Easy'
  ],
  [
    'Which 12th-century Andalusian philosopher wrote influential commentaries on Aristotle known in Europe as "The Commentator"?',
    ['Maimonides', 'Ibn Rushd (Averroes)', 'Al-Ghazali', 'Ibn Arabi'],
    1,
    'Cordoba, 12th c.',
    'His Latin translations helped ignite scholastic philosophy in medieval Paris and Oxford.',
    'Medium'
  ],
  [
    'Which 13th-century Italian mathematician introduced Hindu-Arabic numerals widely to European merchants in Liber Abaci?',
    ['Luca Pacioli', 'Fibonacci (Leonardo of Pisa)', 'Gerolamo Cardano', 'Galileo Galilei'],
    1,
    '1202 CE',
    'His book also posed the famous rabbit-population puzzle generating the Fibonacci sequence.',
    'Medium'
  ],
  [
    'Which 15th-century Ethiopian emperor expanded monastic scholarship and diplomacy with Europe?',
    ['Zara Yaqob', 'Lalibela', 'Menelik II', 'Tewodros II'],
    0,
    '1434–1468 CE',
    'Emperor Zara Yaqob reorganized administration and authored religious treatises.',
    'Hard'
  ],
  [
    'Which 16th-century Ottoman chief architect designed Istanbul’s Suleymaniye Mosque and Selimiye Mosque in Edirne?',
    ['Mimar Sinan', 'Sedefkar Mehmed Agha', 'Ustad Ahmad Lahori', 'Leonardo da Vinci'],
    0,
    'c. 1489–1588',
    'Sinan served three sultans and oversaw more than three hundred major bridges, aqueducts, and mosques.',
    'Medium'
  ],
  [
    'Which 17th-century Japanese haiku master wrote The Narrow Road to the Deep North?',
    ['Kobayashi Issa', 'Matsuo Basho', 'Yosa Buson', 'Ihara Saikaku'],
    1,
    '1689',
    'Basho elevated three-line haikai poetry into an enduring meditative art form.',
    'Medium'
  ],
  [
    'Which 1791 document by Olympe de Gouges argued that women deserved full legal and political equality in France?',
    ['Vindication of the Rights of Woman', 'Declaration of the Rights of Woman and of the Female Citizen', 'Civil Constitution', 'Cahiers de Doleances'],
    1,
    'September 1791',
    'Published shortly before Mary Wollstonecraft’s Vindication in Britain in 1792.',
    'Hard'
  ],
  [
    'Which 1839 treaty guaranteed Belgian neutrality, whose violation by Germany brought Britain into World War I?',
    ['Treaty of London (1839)', 'Treaty of Kiel', 'Congress of Aix-la-Chapelle', 'Treaty of Paris'],
    0,
    'April 1839',
    'German Chancellor Bethmann Hollweg infamously dismissed it as a "scrap of paper" in 1914.',
    'Hard'
  ],
  [
    'Which American engineer launched the first commercially successful steamboat Clermont on the Hudson River in 1807?',
    ['John Fitch', 'Robert Fulton', 'Eli Whitney', 'Isambard Kingdom Brunel'],
    1,
    'August 1807',
    'Steamboats turned upriver travel from weeks into days across the Mississippi and Hudson.',
    'Easy'
  ],
  [
    'Which 1859 oil well drilled by Edwin Drake near Titusville launched the modern petroleum industry?',
    ['Spindletop', 'Drake Well, Pennsylvania', 'Baku Gusher', 'Abadan Field'],
    1,
    'August 1859',
    'Refined kerosene rapidly replaced whale oil for household lighting.',
    'Medium'
  ],
  [
    'Which 1885 German-engineered vehicle by Karl Benz is regarded as the first practical gasoline automobile?',
    ['Model T', 'Benz Patent-Motorwagen', 'Daimler Reitwagen', 'Renault Voiturette'],
    1,
    'Patented January 1886 (built 1885)',
    'Bertha Benz proved its practicality in 1888 with the first long-distance road trip.',
    'Easy'
  ],
  [
    'Which 1911 Chinese revolutionary alliance led by Sun Yat-sen helped overthrow the Qing Dynasty?',
    ['Taiping Society', 'Tongmenghui (Revolutionary Alliance)', 'Boxer League', 'Self-Strengthening Bureau'],
    1,
    'Xinhai Revolution, 1911',
    'Sun Yat-sen formulated the Three Principles of the People: nationalism, democracy, and livelihood.',
    'Hard'
  ],
  [
    'Which 1953 milestone in mountaineering was achieved by Edmund Hillary and Tenzing Norgay?',
    ['First ascent of K2', 'First confirmed summit of Mount Everest', 'First winter crossing of Antarctica', 'First solo ascent of Denali'],
    1,
    'May 29, 1953',
    'Part of John Hunt’s British expedition, they reached 29,029 feet together.',
    'Easy'
  ],
  [
    'Which 1969 live global broadcast was watched by an estimated 650 million television viewers?',
    ['Sputnik telemetry feed', 'Apollo 11 Moon Landing', 'First transatlantic satellite call', 'Voyager 1 Jupiter flyby'],
    1,
    'July 20, 1969',
    'Neil Armstrong and Buzz Aldrin walked on the Sea of Tranquility while Michael Collins orbited above.',
    'Easy'
  ],
  [
    'Which 1977 twin NASA spacecraft carried Golden Records of Earth’s music and greetings into interstellar space?',
    ['Pioneer 10 & 11', 'Voyager 1 & 2', 'Viking 1 & 2', 'Mariner 9 & 10'],
    1,
    'Launched August–September 1977',
    'Both probes later crossed the heliopause and continue transmitting from interstellar space.',
    'Easy'
  ],
  [
    'Which 1994 multi-party election brought Nelson Mandela to the presidency of a democratic South Africa?',
    ['1994 South African General Election', 'Soweto Accord', 'Lusaka Summit', 'Pretoria Convention'],
    0,
    'April 27, 1994',
    'Now celebrated annually in South Africa as Freedom Day.',
    'Easy'
  ]
];
