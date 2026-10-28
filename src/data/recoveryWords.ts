/**
 * The words a recovery code is made of: 2,048 short, plain English words, so
 * each one carries exactly 11 bits and 24 of them carry 264.
 *
 * An original list written for the garden, gentle on purpose: nature, food,
 * home, music and the like, nothing a person would rather not read on a day
 * they are already struggling, no slang, no near-duplicate plurals and no
 * pairs that sound alike. The BIP-39 word list (MIT licensed) was not used;
 * these words are chosen and ordered here.
 *
 * Fixed for good: a code written down today must open the garden in every
 * later build, so a word may never be changed, moved or removed. The tests
 * pin the count, the spelling rules and a digest of the whole list.
 *
 * Loaded only by the lock's setup and by "Use my recovery code".
 */
export const RECOVERY_WORDS: readonly string[] = (
  'abacus abalone abbey acacia acorn acrobat acrylic agate agile airport airy ' +
  'album alder alley almanac almond amber amble amethyst amiable anchor angle ' +
  'anise ankle anorak antelope antenna anthem anvil apple apricot apron ' +
  'aquarium arcade arch aria armchair arrow artwork aspen aster atlas attic ' +
  'aurora author autumn avenue avocado awake award awning axis axle azalea ' +
  'backdrop backpack badge badger bagel bagpipe bake baker bakery balcony ' +
  'ballad ballet balloon ballot balmy bamboo banana band banister banjo banner ' +
  'baobab barber baritone barley barn barnacle barnyard barrel basement basil ' +
  'basin basket basketry bass bassoon bat bath bathtub baton bay bazaar beach ' +
  'beacon bead beagle beam bean beanbag beanie bear beckon bed bedside bedtime ' +
  'bee beet beetroot begonia bell bench beret berry bicycle bilberry bingo ' +
  'birch bird birdbath birthday biscotti biscuit bison blackcap blanket blaze ' +
  'blazer blend blinds blink blintz bloom blooming blossom blue bluebell ' +
  'bluebird bluejay blush board boat bob bobbin bobcat bobolink bobsled boil ' +
  'bold bolt bonfire bongo bonnet book bookcase bookend bookmark bookshop boot ' +
  'borage border bottle bough boulder bounce bouncy bowl bowling bowtie box ' +
  'boxwood bracelet bracken bracket bramble bran branch brave bread breaker ' +
  'breathe breeze breezy brew brick bridge bright brine brioche brisk broad ' +
  'brochure bronze brooch brook broom brownie brush bubble bubbly bucket ' +
  'buckeye buckle bud buff buffalo bugle build builder bulb bulletin bun ' +
  'bundle bungalow bunk bunny bunting burrow bus butler butter buttery button ' +
  'buzzard cabin cabinet caboose cactus cairn cake calendar calico call calm ' +
  'camel camellia camera camp campfire campsite canal canary candle canoe ' +
  'canoeing canopy canvas canyon cap cape captain caption carafe caramel card ' +
  'cardigan cardinal carefree careful cargo caribou carol carousel carpet ' +
  'carrot cart cartoon carve carving cascade cashew cashmere castanet castle ' +
  'cat catalog catfish catkin causeway cavern cedar ceiling celery cellar ' +
  'cello census chair chalet chalk channel chant chapel chapter charades ' +
  'charcoal chart checked checkers cheddar cheerful cheery chef cherry chess ' +
  'chest chestnut chew chick chickpea chicory chiffon chilly chime chipmunk ' +
  'chirpy chisel chive choir chop chord chorus chowder chrome chuckle chummy ' +
  'chutney cinnamon circle cirrus citadel city clam clamp clap clarinet clay ' +
  'clean clear clematis clever cliff climb clip cloak clock clogs closet cloud ' +
  'cloudlet cloudy clove clover coast coaster coat cobalt cobble cobbler ' +
  'cobnut cobweb cocoa coconut coffee coin colander collage collar collect ' +
  'college color comb comet comic compact compass compost concerto conch ' +
  'condor cookbook cookie cool copper coral corduroy cork corn corner cornet ' +
  'corsage cosmos cot cottage cotton couch cougar counter county courier ' +
  'couscous cove cowbell cowslip coyote cozy crab cradle craft crag crane ' +
  'crater crawl crayon cream creamy create creek creekbed crepe crest crib ' +
  'cricket crimson crisp crochet crocus croquet crossing crouton crow crown ' +
  'cruise crumb crumble crumpet crystal cub cuckoo cucumber cuddle cuddly ' +
  'cufflink cumin cumulus cup cupboard cupcake curious curlew curly current ' +
  'curtain cushion custard cutting cyclamen cycle cymbal cypress daffodil ' +
  'dahlia dainty dairy daisy dale dance dancer dapper daring darts dash date ' +
  'dawn daybed daybreak daytime deep deer dell delta denim depot design desk ' +
  'dew dewdrop diagram diamond diary dice dig dimpled diner dinghy dingo ' +
  'dinner diploma dipper discover dish dive dock doctor dogwood dolphin dome ' +
  'domino donkey doodle door doorbell doorknob doormat doorway dormouse dotted ' +
  'dough dove downy doze dragon draw drawer drawing dream dreamy dress drift ' +
  'drill drizzle drum drummer duck duet dumpling dune dusk dusky duvet eager ' +
  'eagle earmuff earnest earth easel easy ebony echo eclair eclipse eggcup ' +
  'eggplant egret elbow elegant elk elm ember emblem emerald emu enamel encore ' +
  'engine envelope errand essay estate estuary etching evening explain explore ' +
  'fable fabric fair falcon fanfare farm farmer fawn feast feather feathery ' +
  'felt fen fence fennel fern ferret ferry festival fiddle field fiesta fig ' +
  'file finch find fir fire firefly fireside fisher fix fjord flag flagpole ' +
  'flame flamingo flannel flapjack flask flax fleece flight flint float ' +
  'florist flower flowery fluffy flurry flute foam fog foggy fold folder folk ' +
  'follow fond fondue foothill footpath ford forest fork fortress forum fossil ' +
  'fountain fox foxglove frame freckle free freesia freezer fresco fresh ' +
  'fridge friendly frisbee frittata fritter frost frosty fruity fry frypan ' +
  'fuchsia fudge funnel furrow fuzzy galaxy gale gallery galoshes garage ' +
  'garden gardener gardenia garlic garnet gate gatepost gather gauge gaze ' +
  'gazebo gazelle gecko gelato gem genial gentian gentle geranium gerbil ' +
  'geyser giant gibbon giggle ginger gingham giraffe give glacier glad glade ' +
  'gladiola glance glass gleaming glen glide glossary glossy glove glowing ' +
  'glue goat goblet gold golden goldfish goldleaf gondola gong goose gopher ' +
  'gorge gorilla gouache goulash gourd gown graceful graft grain grand granite ' +
  'granola grape graphite grass grassy grate grater gravel gravy green ' +
  'greenway greet griddle grill grin grocer grouse grove grow guava guide ' +
  'guitar gulf gull gumdrop guppy gust gypsum habit hail hall hallway hamlet ' +
  'hammock hamper hamster handbell handle handrail hanger happy harbor hardy ' +
  'hare harmony harp harpist harvest hat hatch haven hawk hawthorn hayfield ' +
  'hayloft haystack haze hazel hazelnut headband headland headline hear heart ' +
  'hearth hearty heath heather hedge hedgehog help hemlock herb heron hibiscus ' +
  'hickory highland hike hiker hill hillside hilltop hilly hinge hippo hive ' +
  'hoe holiday hollow holly honest honey honeybee honeydew honeyed hoodie hook ' +
  'hoop hop horizon horn hornbeam horse host hosta hostel hotcake hotel hound ' +
  'house hug hum humble hummus husky hut hyacinth hymn ibex ibis icicle icy ' +
  'igloo iguana imagine impala inch index indigo ink inkpot inkwell inlet inn ' +
  'invent invite iris iron island isle islet ivory ivy jack jackal jacket jade ' +
  'jaguar jam jar jasmine jasper jaunty jelly jersey jester jet jetty jewel ' +
  'jigsaw jingle jog join jolly jonquil journal journey joyful juggler ' +
  'juggling juice juicy jump jumper jungle juniper kale kangaroo kayak kazoo ' +
  'kebab keen keeper keepsake kelp kernel kestrel ketchup kettle key keyboard ' +
  'keyring khaki kilt kimono kind kindly kiosk kitchen kite kitten kiwi knead ' +
  'knee knit knitting knoll knot koala kumquat label lace lacquer lacy ladder ' +
  'ladle ladybird lagoon lake lamb lamp lamppost landmark lane lantern lapis ' +
  'larder lark larkspur latch laugh laundry laurel lava lavender lawn lead ' +
  'leaf leaflet leafy leap learn leather ledge leek leggings lemon lemonade ' +
  'lemony lemur lend lentil leopard lesson letter lettuce level lever library ' +
  'lichen lid lifeboat light lilac lilting lily lilypad lime limpet linden ' +
  'linen linnet lion listen little lively lizard llama lobelia lobster loch ' +
  'locket lodge loft lofty logbook loom lotus lounge loyal lucky lullaby lunch ' +
  'lunchbox lupin lute lychee lynx lyric macaroni macaw mackerel macrame ' +
  'magenta magnet magnolia magpie mahogany mailbox make mallet mallow manatee ' +
  'mandarin mandolin mango manor mantel manual map maple maraca marble march ' +
  'margin marigold marimba marina market marmot maroon marsh marzipan mash ' +
  'mason mattress mauve meadow meander meerkat meet mellow melody melon memo ' +
  'mend menu meringue merry mesa mica midday midnight mild milkweed mill ' +
  'miller mimosa mindful miner mini mink mint minty minuet mirror mirthful ' +
  'miso mist misty mitten mix mixer moat moccasin modest mohair molasses mole ' +
  'mongoose monkey monorail monsoon moon moonbeam moonlit moor moorhen ' +
  'moorland moose morning mosaic moss mossy motel moth motif motto mountain ' +
  'mouse mow muesli muffin muffler mug mulberry mulch mule munch mural murmur ' +
  'museum mushroom music muslin mussel mustard myrtle nail nap napkin narwhal ' +
  'navy neat nectar nest nestle nettle newt nibble nickel nifty night nightjar ' +
  'nimble nimbus noble nod noodle nook noon north notebook notepad notice ' +
  'nougat novel nurse nursery nurture nuthatch nutmeg nutshell nutty nylon oak ' +
  'oakleaf oasis oat oatcake oatmeal oboe observe ocean ocelot ochre octave ' +
  'octopus offer oleander olive omelet onion onyx opal open opera opossum ' +
  'orange orbit orchard orchid orderly oregano organ origami oriole osprey ' +
  'ostrich otter ottoman outcrop outing outline outpost oven overalls owl ' +
  'oyster paddle page pail paint painter pajamas palace palette palm pamphlet ' +
  'pan pancake panda pansy panther pantry paper paprika parade parakeet ' +
  'parfait park parka parlor parrot parsley parsnip pass passport pasta pastel ' +
  'pastry pasture patch path patient pause pavilion pavlova peaceful peach ' +
  'peachy peacock peahen peak peanut peapod pear pearl pebble pebbly pecan ' +
  'pedalo peel pelican pencil penguin peony pepper peppy perky pesto petal ' +
  'petite petunia pewter pheasant phlox piano piazza piccolo pick pickle ' +
  'picnic pie pier pigeon pile pillow pilot pinafore pine pinecone pinewood ' +
  'pink pinwheel piper pippin pita pitcher pizza plaid plain plan planet plant ' +
  'plantain planter plate plateau platinum platter playful plaza pleasant ' +
  'pliers plover pluck plucky plum plumber plush pocket poem poet polar ' +
  'polenta polish polite polka pollen poncho pond ponder pony pool popcorn ' +
  'poplar poppy porch porpoise porridge portrait possum postbox postcard ' +
  'poster potato potter pottery potting pour prairie praline preface pretzel ' +
  'primrose primula print prune pruner pudding puddle puffin pulley pullover ' +
  'puma pump pumpkin puppet puppy pure puzzle quail quaint quartet quartz ' +
  'quest quick quiet quill quilt quilting quince quinoa quiz quokka rabbit ' +
  'raccoon radiant radiator radio radish raffia rain rainboot rainbow raincoat ' +
  'raindrop rainy raisin rake ramble ranch ranger rapids rarebit rattan rattle ' +
  'raven ravioli rayon reap recipe recital recliner redwing redwood reed reef ' +
  'refrain relax relish repair report rest restful rhino rhubarb rhythm ribbon ' +
  'rice rich rickshaw riddle rider ridge ring ripe ripen ripple rise risotto ' +
  'river riverbed rivulet road roam roast robe robin rock rocker rocket ' +
  'rockpool rocky roll rolling rondo roof room roomy rooster root rope rose ' +
  'rosebud rosemary rosy rotunda round row rowan rowboat ruby rug ruler russet ' +
  'rustic rustle rye saddle saffron sage sail sailboat sailor salad salmon ' +
  'salsa samba sand sandal sandbar sandbox sander sandwich sandy sapling ' +
  'sapphire sardine sarong satchel satin sauce saucer saunter savanna savor ' +
  'savory saw scallop scarf scarlet scholar school scissors scone scooter ' +
  'scout scramble scroll seabird seagull seahorse seal search seashell ' +
  'seashore seaside season seed seedbed seedling seedpod seek seesaw sentence ' +
  'sepia sequoia serenade serene sesame settle sew sewing shade shading shadow ' +
  'shady shape share shawl shears shed sheep sheepdog shelf shell shepherd ' +
  'shiny shoebox shoelace shore shorts shovel shower shrimp shutter sidewalk ' +
  'sienna sieve sift signpost silk silky silver simmer simple sing singer sink ' +
  'sip siskin skate sketch ski skiff skillet skip skipper skipping skirt sky ' +
  'skylark skylight slate sled sleek sleep sleet slice slide sliding slipper ' +
  'slogan slope sloth slurp small smart smell smile smith smock smooth snail ' +
  'snappy sneakers sniff snip snow snowball snowcap snowdrop snowfall snowman ' +
  'snowy snug snuggle sock sofa soft solid sonata song songbird sonnet soprano ' +
  'sorbet sorrel sort souffle sound soup soy spacious sparkler sparkly sparrow ' +
  'spatula spice spicy spin spinach spindle spinner spiral splash sponge spool ' +
  'spoon spot spotted spray spread sprig spring sprinkle sprint sprout spruce ' +
  'spry spyglass squall square squash squid squirrel stable stack stadium ' +
  'stairs stake stalk stamp staple stapler star starfish starling starry ' +
  'station statue steady steam steamer steep stem stencil steppe stew sticker ' +
  'still stingray stir stitch stone stool stork storm stormy stove strainer ' +
  'strait straw stream street stretch striped stroll strong strudel studio ' +
  'study sturdy suburb suede sugar sultana summer summit sun sunbeam sundae ' +
  'sundial sunhat sunlit sunny sunrise sunroom sunset sunshine surf swallow ' +
  'swamp swan sway sweater sweet sweetpea swift swim swing sycamore syllable ' +
  'syrup table tablet tack taco tadpole taffeta tail tailor tall tamarack tan ' +
  'tandem tango tangy tape tapestry tapioca tapir tart taste tasty tea teacake ' +
  'teach teacher teacup teak teal teapot teaspoon teatime teddy tempo tend ' +
  'tender tenor tent terrace textbook thatch thaw theater thermos thimble ' +
  'thistle thread thrush thunder thyme ticket tide tidy tiger tile timber ' +
  'timpani tin tinker tinkle tinsel tiny tiptoe titanium title toadflax toast ' +
  'toaster toasty toffee tomato tongs tool toolbox topaz topic topsoil torch ' +
  'tortilla toucan tour towel tower town toy trace tracing track trail train ' +
  'tranquil traveler tray treacle treasure tree treeline treetop trellis ' +
  'trifle trillium trim trip trolley trombone trot trout trowel truffle ' +
  'trumpet trusty tuba tuber tugboat tulip tuna tundra tune tuneful tunic ' +
  'tunnel tureen turkey turmeric turnip turret turtle tutor tuxedo tweed twig ' +
  'twilight twine twirl twisty ukulele umber umbrella umpire unicorn unicycle ' +
  'unwind upbeat upland usher vale valley vanilla vanity vase vast velour ' +
  'velvet velvety veranda verbena verdant verse vest vet vetch village vine ' +
  'vineyard viola violet violin visit vivid volcano vole voyage wade wafer ' +
  'waffle wagon wake wallaby walnut walrus waltz wand wander warbler wardrobe ' +
  'warm washer watch water watering wave wavy waxwing weasel weave weaver ' +
  'weaving wedge weekday weekend welcome wetland whale wharf wheat wheel whelk ' +
  'whirl whisk whisper whistle whittle wicker wide wild wildcat wildwood ' +
  'willow wind windmill window windward windy wing wink winsome winter wire ' +
  'wise wisteria witty wolf wombat wonder wood woodcut woodland woodpile ' +
  'woodruff woody wool woolly word workshop wren wrench write writer yacht yak ' +
  'yam yard yarn yarrow yawn yew yodel yogurt yoyo zebra zephyr zesty zinc ' +
  'zinnia zippy zucchini '
)
  .trim()
  .split(' ')
